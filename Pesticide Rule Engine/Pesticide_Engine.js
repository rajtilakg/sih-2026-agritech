// Tank size is farmer-configurable.
// No fixed SATCHEL lookup is required.
// Examples: 10, 12, 15, 16, 20, 25, 50 L.

// Parse dosage strings safely.
// Supports:
//   "2.0 g/L"
//   "1.5 ml/L"
//   "2.5 g/L + 1.5 ml/L"
//   "N/A"
//   "20 g/pit"
//   "2.5 kg/ha"
function parseDosage(str) {
  if (typeof str !== "string" || !str.trim()) {
    return [{
      num: 0,
      unit: "",
      raw: str,
      isNA: true,
      isPerLitre: false,
      isNonSpray: false
    }];
  }

  const raw = str.trim();
  const lower = raw.toLowerCase();

  // No chemical treatment / N/A
  if (
    raw === "N/A" ||
    lower.includes("no chemical") ||
    lower.includes("no cure")
  ) {
    return [{
      num: 0,
      unit: "",
      raw,
      isNA: true,
      isPerLitre: false,
      isNonSpray: false
    }];
  }

  // Split compound formulations such as:
  // "2.5 g/L + 1.5 ml/L"
  const parts = raw.split("+").map(p => p.trim()).filter(Boolean);

  return parts.map(part => {
    const numMatch = part.match(/(\d+(?:\.\d+)?)/);
    const num = numMatch ? parseFloat(numMatch[1]) : NaN;

    // Explicitly detect dosage denominator
    const perLitre = /\/\s*L\b/i.test(part);
    const nonSpray =
      /\/\s*(pit|ha|acre|kg|g)\b/i.test(part) ||
      !perLitre;

    // Extract unit before /L
    let unit = "";

    if (perLitre) {
      const unitMatch = part.match(
        /\d+(?:\.\d+)?\s*([a-zA-Z]+)\s*\/\s*L/i
      );

      if (unitMatch) {
        unit = unitMatch[1];
      }
    }

    return {
      num: Number.isFinite(num) ? num : 0,
      unit,
      raw: part,
      isNA: false,
      isPerLitre: perLitre,
      isNonSpray: nonSpray,
      denominator: perLitre ? "L" : null
    };
  });
}


function diagnosis(cropKey, diseaseKey, satchelLiters = 16) {

  // -------------------------
  // Input validation
  // -------------------------

  if (
    cropKey === undefined ||
    cropKey === null ||
    cropKey === ""
  ) {
    return {
      error: "Crop name required",
      crop: cropKey,
      banned: false,
      safe: false
    };
  }

  if (
    typeof cropKey !== "string" &&
    typeof cropKey !== "number"
  ) {
    return {
      error: "Crop must be a string",
      safe: false
    };
  }

  if (
    diseaseKey === undefined ||
    diseaseKey === null ||
    diseaseKey === ""
  ) {
    return {
      error: "Disease/pest required",
      safe: false
    };
  }

  if (
    typeof satchelLiters !== "number" ||
    !Number.isFinite(satchelLiters) ||
    satchelLiters <= 0
  ) {
    return {
      error:
        "Invalid tank size — enter a positive number in litres (e.g., 10, 12, 15, 16, 20, 25, 50 L)",
      safe: false,
      satchelLiters
    };
  }

  // -------------------------
  // Crop lookup
  // -------------------------

  const normalizedCrop =
    String(cropKey).toLowerCase().trim();

  const crop = CIBRC[normalizedCrop];

  if (!crop) {
    return {
      error:
        "Crop not supported. Please select a crop from the supported CIBRC-derived dataset.",
      crop: cropKey,
      banned: false,
      safe: false
    };
  }

  // Support both diseases and pests if the dataset eventually
  // separates them.
  const allDiseases = {
    ...(crop.diseases || {}),
    ...(crop.pests || {})
  };

  // -------------------------
  // Disease normalization
  // -------------------------

  const norm = (value) =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const requestedDisease = String(diseaseKey).trim();

  let match = allDiseases[requestedDisease];

  // Exact normalized match
  if (!match) {
    const target = norm(requestedDisease);

    for (const [key, value] of Object.entries(allDiseases)) {
      if (norm(key) === target) {
        match = value;
        break;
      }
    }
  }

  // Conservative partial match
  if (!match) {
    const target = norm(requestedDisease);

    for (const [key, value] of Object.entries(allDiseases)) {
      const normalizedKey = norm(key);

      if (
        normalizedKey.includes(target) ||
        target.includes(normalizedKey)
      ) {
        match = value;
        break;
      }
    }
  }

  if (!match) {
    return {
      error:
        "Unknown disease/pest for this crop. Select a supported option.",
      crop: cropKey,
      disease: diseaseKey,
      banned: false,
      safe: false,
      source:
        "CIBRC-derived reference dataset — verify independently",
      notes:
        "This combination is not verified. Confirm the diagnosis with a local agricultural extension officer."
    };
  }

  // -------------------------
  // Dosage calculation
  // -------------------------

  const dosagePerL = match.d;
  const parsed = parseDosage(dosagePerL);

  let total = "N/A";

  if (parsed.every(p => p.isNA)) {

    total = "N/A";

  } else if (parsed.every(p => p.isNonSpray)) {

    total =
      "Not applicable — this is not a per-litre spray rate.";

  } else if (parsed.some(p => p.isNonSpray)) {

    total =
      "Not calculated — dosage contains a non-per-litre component.";

  } else {

    total = parsed
      .map(p =>
        `${(p.num * satchelLiters).toFixed(2)} ${p.unit}`
      )
      .join(" + ");
  }

  // -------------------------
  // Safety / verification
  // -------------------------

  const isBanned = match.banned === true;

  const isVerified =
    Boolean(
      match &&
      match.c &&
      match.d &&
      !isBanned
    );

  return {
    crop: normalizedCrop,
    disease: requestedDisease,

    recommendation: isBanned
      ? "DO NOT USE — BANNED BY CIBRC"
      : match.c,

    dosagePerLiter: dosagePerL,

    totalDoseForSatchel: total,

    satchelLiters,

    banned: isBanned,

    safe: !isBanned,

    region: "Maharashtra",

    source: isVerified
      ? "CIBRC-derived reference dataset — verify independently"
      : "Reference dataset — verify with an agricultural extension officer",

    compliance: isVerified
      ? "Reference data — independently verify current label approval"
      : "Not independently verified — confirm with local extension",

    notes: isBanned
      ? "Do not use this product. Confirm an approved alternative with a local agricultural extension officer."
      : (
          match.c &&
          match.d &&
          match.d !== "N/A"
            ? "Follow the current product label, crop-specific approved instructions, and local agricultural extension advice. Confirm that the product is approved for this crop and condition before application."
            : "No chemical treatment recommended. Confirm with local agricultural extension."
        )
  };
}


// ============================================================
// SPRAY PLAN
// ============================================================
//
// IMPORTANT:
// - satchelLiters is fully variable.
// - The pesticide concentration remains at the supplied
//   per-litre rate.
// - Stage/soil adjustments affect WATER VOLUME only.
// - These multipliers are estimates, NOT official label rates.
// ============================================================

const SOIL_MULT = {
  black_soil: 0.85,
  red_soil: 1.10,
  alluvial: 0.95,
  saline: 1.30,
  sandy: 1.25
};

const STAGE_MULT = {
  seedling: 0.60,
  vegetative: 1.00,
  flowering: 1.15,
  fruiting: 1.30,
  harvest: 0.80
};


function sprayPlan({
  crop,
  disease,
  areaHa = 1,
  stage = "vegetative",
  soil = "black_soil",
  satchelLiters = 16
}) {

  // -------------------------
  // Validation
  // -------------------------

  if (
    typeof areaHa !== "number" ||
    !Number.isFinite(areaHa) ||
    areaHa <= 0
  ) {
    return {
      error:
        "Invalid area — enter a positive number in hectares (e.g., 1, 2.5, 5)",
      safe: false
    };
  }

  if (
    typeof satchelLiters !== "number" ||
    !Number.isFinite(satchelLiters) ||
    satchelLiters <= 0
  ) {
    return {
      error:
        "Invalid tank size — enter a positive number in litres (e.g., 10, 12, 15, 16, 20, 25, 50)",
      safe: false,
      satchelLiters
    };
  }

  const validStages = Object.keys(STAGE_MULT);
  const validSoils = Object.keys(SOIL_MULT);

  if (!validStages.includes(stage)) {
    stage = "vegetative";
  }

  if (!validSoils.includes(soil)) {
    soil = "black_soil";
  }


  // -------------------------
  // Get diagnosis
  // -------------------------

  // We use the farmer's tank size here so the diagnosis also
  // calculates the amount required for one full tank.
  const base = diagnosis(
    crop,
    disease,
    satchelLiters
  );

  if (
    !base ||
    base.error ||
    base.banned ||
    !base.recommendation
  ) {
    return {
      error:
        base?.error ||
        "Unknown disease/pest for this crop.",
      crop,
      disease,
      safe: false,
      notes:
        base?.notes ||
        "Confirm with a local agricultural extension officer."
    };
  }


  // -------------------------
  // Check whether this is
  // actually a per-litre spray
  // -------------------------

  const dosageStr = base.dosagePerLiter;
  const parsed = parseDosage(dosageStr);

  if (
    parsed.length === 0 ||
    parsed.every(p => p.isNA)
  ) {
    return {
      error:
        "No per-litre chemical spray dosage is available for this recommendation.",
      safe: false,
      crop,
      disease,
      recommendation: base.recommendation,
      dosage: dosageStr,
      notes:
        "Confirm the appropriate management method with a local agricultural extension officer."
    };
  }

  if (
    parsed.some(p => p.isNonSpray)
  ) {
    return {
      error:
        "This recommendation is not a per-litre spray dosage. Tank-volume calculation is not applicable.",
      safe: false,
      crop,
      disease,
      recommendation: base.recommendation,
      dosage: dosageStr,
      notes:
        "Dosages expressed per pit, hectare, acre, etc. must be calculated according to their own label units rather than converted into tank dosage."
    };
  }


  // -------------------------
  // WATER VOLUME
  // -------------------------
  //
  // This is an ESTIMATE based on your existing model.
  // It must not override the pesticide label's specified
  // spray volume.
  //

  const litersPerHa = 500;

  const baseVolumeL =
    litersPerHa * areaHa;

  const stageFactor =
    STAGE_MULT[stage];

  const soilFactor =
    SOIL_MULT[soil];

  const adjustedVolumeL =
    baseVolumeL *
    stageFactor *
    soilFactor;


  // -------------------------
  // CHEMICAL CALCULATION
  // -------------------------
  //
  // IMPORTANT:
  // The concentration stays unchanged.
  //
  // Example:
  // 2 ml/L × 16 L = 32 ml
  //
  // It does NOT become 2.4 ml/L because of soil/stage.
  //

  const chemicalTotals = parsed.map(p => ({
    unit: p.unit,
    amount:
      p.num * adjustedVolumeL
  }));


  // -------------------------
  // TANK CALCULATION
  // -------------------------

  const fullTanks =
    Math.floor(
      adjustedVolumeL / satchelLiters
    );

  const finalTankL =
    Number(
      (
        adjustedVolumeL -
        fullTanks * satchelLiters
      ).toFixed(2)
    );

  // Floating point protection
  const hasPartialTank =
    finalTankL > 0.01;

  const totalTanks =
    Math.ceil(
      adjustedVolumeL / satchelLiters
    );


  // Chemical needed for one complete tank
  const chemicalPerFullTank =
    parsed.map(p =>
      `${(p.num * satchelLiters).toFixed(2)} ${p.unit}`
    ).join(" + ");


  // Chemical needed for the final partial tank
  const chemicalPerFinalTank =
    hasPartialTank
      ? parsed.map(p =>
          `${(p.num * finalTankL).toFixed(2)} ${p.unit}`
        ).join(" + ")
      : null;


  // Total chemical required across the whole field
  const totalChemicalRequired =
    chemicalTotals
      .map(item =>
        `${item.amount.toFixed(2)} ${item.unit}`
      )
      .join(" + ");


  // -------------------------
  // RETURN
  // -------------------------

  return {

    crop,

    disease,

    areaHa,

    stage,

    soil,

    satchelLiters,

    recommendation:
      base.recommendation,

    baseSprayVolumeL:
      Number(baseVolumeL.toFixed(1)),

    adjustedSprayVolumeL:
      Number(adjustedVolumeL.toFixed(1)),

    stageFactor,

    soilFactor,

    dosagePerLiter:
      dosageStr,

    chemicalPerFullTank,

    chemicalPerFinalTank,

    fullTanks,

    finalPartialL:
      hasPartialTank
        ? `${finalTankL.toFixed(2)} L`
        : null,

    totalTanks,

    totalSprayVolumeL:
      `${adjustedVolumeL.toFixed(1)} L`,

    totalChemicalRequired,

    recommendedSatchels:
      totalTanks,

    safe:
      base.safe,

    banned:
      base.banned,

    source:
      base.source,

    notes:
      `Water-volume estimate only: stage ${stage} (${(
        stageFactor * 100
      ).toFixed(0)}%) and soil ${soil} (${(
        soilFactor * 100
      ).toFixed(0)}%). The pesticide concentration remains at the supplied rate of ${dosageStr}. Do not increase pesticide concentration based on stage or soil. Always follow the current product label and locally approved instructions.`
  };
}


// ============================================================
// EXPORTS
// ============================================================

if (
  typeof module !== "undefined" &&
  module.exports
) {
  module.exports = {
    CIBRC,
    diagnosis,
    sprayPlan,
    SOIL_MULT,
    STAGE_MULT
  };
}