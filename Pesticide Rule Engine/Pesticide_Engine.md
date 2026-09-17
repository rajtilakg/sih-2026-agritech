# Krishirakshak Field Spray Engine — Integration Guide

File `engine.js`
Dependencies None — pure JavaScript, suitable for React Native
Region Maharashtra, India
Mode Offline-first
Network calls None

 Important This engine is a computationalreference engine. The pesticide entries and doses must be verified against the current approved product label and applicable official agricultural guidance before real-world application. The engine must not be presented as independently certifying that a product is currently approved or legal.

---

## 1. What the Engine Does

The engine converts a crop + diseasepest selection into

1. A primary treatment recommendation
2. An optional alternative treatment
3. The supplied pesticide concentration
4. The chemical quantity required for the farmer's tank size
5. An estimated total spray-water requirement for the field
6. The number of full tanks required
7. The quantity required for the final partial tank
8. The total chemical quantity required across the calculated spray volume

The engine supports farmer-configurable tanksatchel sizes rather than restricting farmers to a fixed list.

Examples

```text
10 L
12 L
15 L
16 L
20 L
25 L
50 L
```

Any positive numeric tank capacity can be supplied.

Default

```text
16 L
```

---

# 2. Crops Covered

The current reference dataset contains 28 crops

 Crop           Entries 
 -------------  ------ 
 Cotton              10 
 Rice                10 
 Wheat               10 
 Maize (Corn)        10 
 Sugarcane           10 
 Turmeric            10 
 Groundnut           10 
 Tomato              10 
 Onion               10 
 Grapes              10 
 Mango               10 
 Banana              10 
 Pomegranate         10 
 Chickpea            10 
 Soybean             10 
 Sunflower           10 
 Jowar               10 
 Bajra               10 
 Potato              10 
 Pea                 10 
 Garlic              10 
 Finger Millet       10 
 Tea                 10 
 Coffee              10 
 Cumin               10 
 Lentil              10 
 Sesame              10 
 Niger               10 

Total 280 reference diseasepest entries.

---

# 3. Tank  Satchel Size

The tank size is fully farmer-configurable.

There is no longer a fixed

```js
SATCHEL = {
  15 15,
  16 16,
  20 20
}
```

lookup.

Instead

```js
diagnosis(tomato, Late_Blight, 16);
```

or

```js
diagnosis(tomato, Late_Blight, 20);
```

or

```js
diagnosis(tomato, Late_Blight, 12);
```

All are valid.

The frontend should therefore use a numeric tank-capacity input, not a hard-coded 151620 selector.

---

# 4. Basic Usage

```js
import { diagnosis, sprayPlan } from .engine;

const basic = diagnosis(
  tomato,
  Late_Blight,
  16
);
```

The result provides the treatment and the amount required for one complete 16 L tank.

For a full field calculation

```js
const plan = sprayPlan({
  crop tomato,
  disease Late_Blight,
  areaHa 2.5,
  stage flowering,
  soil black_soil,
  satchelLiters 16
});
```

---

# 5. `diagnosis()` API

```js
diagnosis(
  cropKey,
  diseaseKey,
  satchelLiters = 16
)
```

### Parameters

 Parameter        Type           Required  Description                          
 ---------------  -------------  --------  ------------------------------------ 
 `cropKey`        stringnumber  Yes       Crop identifier                      
 `diseaseKey`     string         Yes       Diseasepest identifier              
 `satchelLiters`  number         No        Farmer's tank capacity; default 16 L 

The function validates that the tank size is a positive finite number.

---

# 6. Primary + Alternative Treatments

Each reference entry can contain

```js
{
  c Primary formulation,
  d Primary dosage,
  alt_c Alternative formulation,
  alt_d Alternative dosage
}
```

Example

```js
{
  c Acetamiprid 20% SP,
  d 0.5 gL,
  alt_c Imidacloprid 17.8% SL,
  alt_d 0.3 mlL
}
```

The API exposes both treatments separately.

### Primary

```js
primaryTreatment {
  chemical,
  dosagePerLiter,
  chemicalPerFullTank,
  chemicalPerFinalTank,
  totalChemicalRequired
}
```

### Alternative

```js
alternativeTreatment {
  chemical,
  dosagePerLiter,
  chemicalPerFullTank,
  chemicalPerFinalTank,
  totalChemicalRequired
}
```

The alternative is not automatically mixed with the primary treatment.

It represents a separate treatment option.

---

# 7. Dosage Parsing

`parseDosage()` safely handles

```text
2.0 gL
1.5 mlL
2.5 gL + 1.5 mlL
NA
20 gpit
2.5 kgha
```

Compound formulations are calculated component-by-component.

Example

```js
diagnosis(
  grapes,
  Black_Rot,
  16
);
```

For

```text
2.5 gL + 1.0 gL
```

the engine calculates

```text
40.00 g + 16.00 g
```

for one 16 L tank.

---

# 8. Non-Spray Dosages

The engine does not blindly convert non-litre dosages into tank quantities.

Examples

```text
20 gpit
2.5 kgha
```

are treated as non-sprayper-unit recommendations.

The engine will not pretend these are equivalent to

```text
X gL
```

This prevents incorrect unit conversion.

---

# 9. No-Cure  NA Conditions

Conditions containing

```text
NA
No cure
No chemical
```

are handled as non-chemical recommendations.

Example

```js
{
  recommendation No chemical cure - vector control,
  dosagePerLiter NA
}
```

The spray-plan calculation should not invent a pesticide quantity for these cases.

---

# 10. Disease Name Matching

Diseasepest keys use the dataset's identifiers, but the engine supports normalization.

For example, these can resolve to the same entry

```text
Late_Blight
lateblight
Late Blight
late_blight
```

Normalization removes case and non-alphanumeric differences.

A conservative partial-match fallback is also supported.

---

# 11. `sprayPlan()` API

```js
sprayPlan({
  crop,
  disease,
  areaHa = 1,
  stage = vegetative,
  soil = black_soil,
  satchelLiters = 16
})
```

### Parameters

 Parameter        Type    Default       Description            
 ---------------  ------  ------------  ---------------------- 
 `crop`           string  Required      Crop key               
 `disease`        string  Required      Diseasepest key       
 `areaHa`         number  `1`           Field area in hectares 
 `stage`          string  `vegetative`  Growth stage           
 `soil`           string  `black_soil`  Soil category          
 `satchelLiters`  number  `16`          Farmer's tank capacity 

Supported stages

```text
seedling
vegetative
flowering
fruiting
harvest
```

Supported soil categories

```text
black_soil
red_soil
alluvial
saline
sandy
```

---

# 12. Water-Volume Calculation

The current prototype contains

```js
const litersPerHa = 500;
```

and applies the configured stage and soil factors to the water-volume estimate.

Conceptually

```text
Base water volume
= litersPerHa × areaHa

Adjusted water volume
= base water volume
  × stage factor
  × soil factor
```

### Important

These water-volume calculations are estimates in the current prototype.

They are not automatically authoritative CIBRC label rates.

If an official productcrop recommendation specifies a particular spray volume, that authoritative value should take precedence over the prototype estimate.

The engine should therefore not describe the current `500 Lha` value or the multipliers as government-prescribed values.

---

# 13. Growth Stage Factors

The current prototype contains

 Stage       Factor 
 ----------  ----- 
 Seedling      0.60 
 Vegetative    1.00 
 Flowering     1.15 
 Fruiting      1.30 
 Harvest       0.80 

### Important

These are prototype water-volume adjustment factors.

They do not increase or decrease the pesticide concentration.

For example, if the supplied recommendation is

```text
2 mlL
```

the engine does not turn it into

```text
2.6 mlL
```

during flowering.

The concentration remains

```text
2 mlL
```

Only the estimated total spray-water volume changes.

These multipliers should not be presented as CIBRC-approved dose adjustments.

---

# 14. Soil Factors

The current prototype contains

 Soil        Factor 
 ----------  ----- 
 Black soil    0.85 
 Red soil      1.10 
 Alluvial      0.95 
 Saline        1.30 
 Sandy         1.25 

These factors currently modify the prototype water-volume estimate only.

They must not be interpreted as official pesticide dose adjustments.

The engine must never multiply

```text
2 mlL
```

into

```text
2.5 mlL
```

because of soil type.

The pesticide concentration remains the supplied rate.

---

# 15. Tank Calculation

Once the estimated total spray-water volume is known, the engine calculates

```js
fullTanks = Math.floor(
  adjustedVolumeL  satchelLiters
);
```

Then

```js
finalTankL =
  adjustedVolumeL -
  fullTanks  satchelLiters;
```

and

```js
totalTanks =
  Math.ceil(
    adjustedVolumeL  satchelLiters
  );
```

Therefore, arbitrary tank sizes are supported.

Example

```text
Total spray volume 530 L
Tank size 16 L
```

The engine calculates

```text
33 full tanks = 528 L
Final partial tank = 2 L
Total tanks required = 34
```

The chemical quantity for the final tank is calculated using the actual partial volume.

---

# 16. Chemical Calculation

For a supplied concentration

```text
2.5 gL
```

and a

```text
16 L
```

tank

```text
2.5 × 16
= 40 g
```

For a partial

```text
8 L
```

tank

```text
2.5 × 8
= 20 g
```

The pesticide concentration itself remains unchanged.

---

# 17. `sprayPlan()` Return Structure

The current engine returns a structure broadly following

```js
{
  crop,
  disease,
  areaHa,
  stage,
  soil,
  satchelLiters,

  waterVolumeInfo {
    baseSprayVolumeL,
    adjustedSprayVolumeL,
    stageFactor,
    soilFactor,
    recommendedSatchels,
    fullTanks,
    finalPartialL
  },

  primaryTreatment {
    chemical,
    dosagePerLiter,
    chemicalPerFullTank,
    chemicalPerFinalTank,
    totalChemicalRequired
  },

  alternativeTreatment {
    chemical,
    dosagePerLiter,
    chemicalPerFullTank,
    chemicalPerFinalTank,
    totalChemicalRequired
  },

  safe,
  banned,
  notes
}
```

`alternativeTreatment` may be `null` when no alternative is available.

---

# 18. Frontend Display

The frontend should present the result in two clear sections.

### Primary Treatment

Display

```text
Recommended treatment
Dose per litre
Amount for one full tank
Amount for final partial tank
Total chemical required
```

### Alternative Treatment

If available

```text
Alternative treatment
Dose per litre
Amount for one full tank
Amount for final partial tank
Total chemical required
```

The alternative should be visually presented as an alternative, not as something to combine with the primary treatment.

---

# 19. Farmer Input Flow

Recommended frontend flow

```text
Select Crop
      ↓
Select Disease  Pest
      ↓
Enter Field Area
      ↓
Enter Tank Capacity
      ↓
Select Growth Stage
      ↓
Select Soil Type
      ↓
Generate Spray Plan
      ↓
Primary Treatment
      +
Alternative Treatment
      +
Water  Tank Calculation
```

Tank capacity should be a numeric input because farmers may use different sprayer capacities.

---

# 20. Data Structure

The reference data follows

```text
CIBRC[cropKey]
  └── diseases
       └── diseaseKey
            ├── c
            ├── d
            ├── alt_c
            └── alt_d
```

Where

```text
c     = primary formulation
d     = primary dosage
alt_c = alternative formulation
alt_d = alternative dosage
```

The engine may also support

```text
crop.pests
```

if pest entries are separated into their own object in the future.

---

# 21. Important Data Verification Rule

The dataset is a reference dataset and should not be treated as automatically verified merely because an entry exists in `CIBRC`.

Before real-world use, each crop + condition + formulation + dosage combination should be checked against the current applicable official sourceproduct label.

The engine's presence of

```js
banned false
```

must not be interpreted as independent proof that a product is currently approved.

Likewise

```js
safe true
```

means the engine did not identify a configured blocking condition; it is not a substitute for label, regulatory, or agronomic verification.

---

# 22. Error Handling

The frontend must handle returned error objects gracefully.

Possible errors include

```text
Crop name required
Diseasepest required
Invalid tank size
Crop not supported
Unknown diseasepest for this crop
This recommendation is not a per-litre spray dosage
```

Do not display a successful spray calculation when the engine returns

```js
safe false
```

or an `error`.

---

# 23. Special Treatment Cases

Some conditions have no chemical cure.

These should remain informational rather than being converted into a normal pesticide spray plan.

Examples include conditions described as

```text
No chemical cure
Vector control
Resistant variety
Uprootremove affected plants
```

Where an alternative treatment is actually a vector-control treatment rather than a cure, the frontend should describe it accordingly.

Do not label vector control as a cure for the underlying disease.

---

# 24. Multi-Chemical Formulations

The parser supports combinations such as

```text
2.5 gL + 1.0 gL
```

Each component is calculated independently.

Example

```js
diagnosis(
  grapes,
  Black_Rot,
  16
);
```

can return

```text
2.5 gL + 1.0 gL
```

which corresponds mathematically to

```text
40.00 g + 16.00 g
```

for a 16 L tank.

---

# 25. Offline Operation

The engine has

```text
No API dependency
No network dependency
No external npm dependency
```

The frontend can bundle the engine directly.

This allows the computational portion of the spray-planning workflow to operate offline.

However, offline operation does not mean that regulatoryproduct data is permanently current. The reference dataset should be versioned and periodically reviewed.

---

# 26. Frontend Integration Checklist

 [ ] Import `diagnosis` and `sprayPlan`
 [ ] Build crop picker
 [ ] Build diseasepest picker filtered by crop
 [ ] Build numeric tank-capacity input
 [ ] Default tank capacity to 16 L
 [ ] Do not hard-code a 151620 L-only restriction
 [ ] Build growth-stage picker
 [ ] Build soil-type picker
 [ ] Build field-area input
 [ ] Call `diagnosis()` for per-tank calculation
 [ ] Call `sprayPlan()` for full-field calculation
 [ ] Display primary treatment
 [ ] Display alternative treatment when available
 [ ] Clearly distinguish primary vs alternative
 [ ] Display dose per litre
 [ ] Display chemical quantity per full tank
 [ ] Display chemical quantity for final partial tank
 [ ] Display total estimated water volume
 [ ] Display total estimated chemical requirement
 [ ] Display number of tanks
 [ ] Handle `NA` and non-spray recommendations
 [ ] Handle `safe false`
 [ ] Handle error objects
 [ ] Do not present prototype water-volume factors as government-prescribed rates
 [ ] Test completely offline

---

# 27. Backend Integration Checklist

 [ ] Keep `sprayPlan()` as the calculation authority
 [ ] Validate all farmer inputs server-side where applicable
 [ ] Preserve arbitrary positive `satchelLiters`
 [ ] Do not duplicate pesticide arithmetic in the frontend
 [ ] Preserve primaryalternative treatment separation
 [ ] Preserve dosage units
 [ ] Do not convert `per-ha`, `per-acre`, or `per-pit` doses into per-litre doses without authoritative conversion data
 [ ] Return calculation errors rather than silently guessing
 [ ] Preserve sourceverification metadata when the dataset is expanded
 [ ] Version the reference dataset
 [ ] Do not expose `safe true` as a claim of regulatory approval

---

# 28. Core Design Principle

The engine follows this separation

```text
REFERENCE DOSE
      ↓
ESTIMATED  AUTHORITATIVE WATER VOLUME
      ↓
FIELD AREA
      ↓
TOTAL SPRAY VOLUME
      ↓
FARMER TANK CAPACITY
      ↓
FULL TANKS + FINAL PARTIAL TANK
      ↓
CHEMICAL REQUIRED PER TANK
```

The most important rule is

```text
Changing tank size changes the amount of chemical
placed into each tank.

It does NOT change the pesticide concentration.
```

Likewise

```text
Stage  soil factors affect the current prototype's
water-volume estimate only.

They do NOT change the pesticide concentration.
```

---

# 29. Example

```js
const plan = sprayPlan({
  crop tomato,
  disease Late_Blight,
  areaHa 2.5,
  stage flowering,
  soil black_soil,
  satchelLiters 16
});
```

The frontend can then display

```text
Primary Treatment
────────────────────────
Product [primary formulation]
Dose [supplied rate]

Per 16 L tank
[calculated quantity]

Final partial tank
[calculated quantity]

Total estimated chemical
[calculated quantity]


Alternative Treatment
────────────────────────
Product [alternative formulation]
Dose [alternative rate]

Per 16 L tank
[calculated quantity]


Field Spray Plan
────────────────────────
Area 2.5 ha
Tank capacity 16 L
Estimated water [calculated]
Full tanks [calculated]
Final partial tank [calculated]
Total tanks [calculated]
```

The exact pesticide quantities must always be interpreted according to the current applicable product label and official agricultural guidance.

---

# 30. Final Notes

 This is an offline-first computationalreference engine.
 Tank capacity is fully configurable.
 Primary and alternative formulations are supported.
 Compound formulations are supported.
 Non-spray units are not blindly converted.
 Partial tanks are calculated mathematically.
 Pesticide concentration is kept unchanged by tank size, stage, or soil.
 The current stagesoil and `500 Lha` logic is prototype estimation logic, not an official government prescription.
 Current pesticideproduct entries require independent verification against applicable official sources and product labels before real-world deployment.
 The dataset is intended for Maharashtra-focused use.
 The engine should be treated as a calculation layer, not as a substitute for agronomic or regulatory verification.
