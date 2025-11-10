// Unit Conversion Helper
export const unitConverter = {
  // Conversion factors to base units
  weight: {
    kg: 1,
    g: 0.001,
    lb: 0.453592,
    oz: 0.0283495
  },

  volume: {
    L: 1,
    ml: 0.001,
    cup: 0.236588,
    tbsp: 0.0147868,
    tsp: 0.00492892
  },

  // Get unit category
  getCategory(unit) {
    if (this.weight[unit]) return 'weight';
    if (this.volume[unit]) return 'volume';
    return 'other';
  },

  // Convert between units
  convert(value, fromUnit, toUnit) {
    const category = this.getCategory(fromUnit);

    if (category === 'other') {
      return value; // Can't convert custom units
    }

    const conversionTable = category === 'weight' ? this.weight : this.volume;

    if (!conversionTable[fromUnit] || !conversionTable[toUnit]) {
      return value; // Units not in same category
    }

    // Convert to base unit, then to target unit
    const baseValue = value * conversionTable[fromUnit];
    return baseValue / conversionTable[toUnit];
  },

  // Get price per different units
  getPriceBreakdown(quantity, unit, totalPrice) {
    const category = this.getCategory(unit);
    const pricePerUnit = totalPrice / quantity;
    const breakdown = { [unit]: pricePerUnit };

    if (category === 'weight') {
      const baseQuantity = quantity * this.weight[unit]; // Convert to kg
      const pricePerKg = totalPrice / baseQuantity;

      breakdown.kg = pricePerKg;
      breakdown.g = pricePerKg * this.weight.g;
      breakdown.lb = pricePerKg * this.weight.lb;
      breakdown.oz = pricePerKg * this.weight.oz;
    } else if (category === 'volume') {
      const baseQuantity = quantity * this.volume[unit]; // Convert to L
      const pricePerL = totalPrice / baseQuantity;

      breakdown.L = pricePerL;
      breakdown.ml = pricePerL * this.volume.ml;
      breakdown.cup = pricePerL * this.volume.cup;
      breakdown.tbsp = pricePerL * this.volume.tbsp;
      breakdown.tsp = pricePerL * this.volume.tsp;
    }

    return breakdown;
  },

  // Calculate cost for a different unit
  calculateCost(purchaseQty, purchaseUnit, purchasePrice, useQty, useUnit) {
    const category = this.getCategory(purchaseUnit);

    if (category === 'other' || purchaseUnit === useUnit) {
      // Same unit or can't convert, use direct calculation
      return (purchasePrice / purchaseQty) * useQty;
    }

    const conversionTable = category === 'weight' ? this.weight : this.volume;

    if (!conversionTable[useUnit]) {
      // Can't convert, use direct calculation
      return (purchasePrice / purchaseQty) * useQty;
    }

    // Convert purchase to base unit
    const basePurchaseQty = purchaseQty * conversionTable[purchaseUnit];
    const pricePerBaseUnit = purchasePrice / basePurchaseQty;

    // Convert use quantity to base unit
    const baseUseQty = useQty * conversionTable[useUnit];

    return pricePerBaseUnit * baseUseQty;
  }
};
