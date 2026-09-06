'use strict';

/**
 * Catalogo base de recompensas MM2.
 *
 * Nombres, valores y stock viven en la base de datos y los administra el
 * staff. Esto es solo el punto de partida de una instalacion nueva; el
 * frontend jamas mantiene su propia lista.
 */
module.exports = [
  // Godly
  { slug: 'chroma-luger',      name: 'Chroma Luger',      rarity: 'godly',     category: 'gun',   value_robux: 42000, accent: '#b085ff', stock: 3 },
  { slug: 'chroma-seer',       name: 'Chroma Seer',       rarity: 'godly',     category: 'knife', value_robux: 38500, accent: '#7ce0ff', stock: 2 },
  { slug: 'elderwood-scythe',  name: 'Elderwood Scythe',  rarity: 'godly',     category: 'knife', value_robux: 26000, accent: '#7bd88f', stock: 4 },
  { slug: 'batwing',           name: 'Batwing',           rarity: 'godly',     category: 'knife', value_robux: 18500, accent: '#8b7bff', stock: 6 },
  { slug: 'corrupt',           name: 'Corrupt',           rarity: 'godly',     category: 'knife', value_robux: 12000, accent: '#ff7ba8', stock: 8 },
  // Ancient
  { slug: 'ancient-blade',     name: 'Ancient Blade',     rarity: 'ancient',   category: 'knife', value_robux: 9500,  accent: '#ffb454', stock: 5 },
  { slug: 'ancient-revolver',  name: 'Ancient Revolver',  rarity: 'ancient',   category: 'gun',   value_robux: 8800,  accent: '#ffb454', stock: 5 },
  // Vintage
  { slug: 'vintage-shard',     name: 'Vintage Shard',     rarity: 'vintage',   category: 'knife', value_robux: 6400,  accent: '#e0c68a', stock: 9 },
  { slug: 'vintage-pistol',    name: 'Vintage Pistol',    rarity: 'vintage',   category: 'gun',   value_robux: 5900,  accent: '#e0c68a', stock: 7 },
  // Legendary
  { slug: 'nebula',            name: 'Nebula',            rarity: 'legendary', category: 'knife', value_robux: 4200,  accent: '#66d4ff', stock: 12 },
  { slug: 'icepiercer',        name: 'Icepiercer',        rarity: 'legendary', category: 'knife', value_robux: 3600,  accent: '#8fe6ff', stock: 12 },
  { slug: 'heat-gun',          name: 'Heat',              rarity: 'legendary', category: 'gun',   value_robux: 3100,  accent: '#ff9d5c', stock: 10 },
  // Rare
  { slug: 'ginger-luger',      name: 'Ginger Luger',      rarity: 'rare',      category: 'gun',   value_robux: 2200,  accent: '#ffcf72', stock: 18 },
  { slug: 'candy-cane',        name: 'Candy Cane',        rarity: 'rare',      category: 'knife', value_robux: 1800,  accent: '#ff8fa8', stock: 20 },
  // Uncommon
  { slug: 'skool',             name: 'Skool',             rarity: 'uncommon',  category: 'knife', value_robux: 1200,  accent: '#8fd4b0', stock: 25 },
  { slug: 'tides',             name: 'Tides',             rarity: 'uncommon',  category: 'knife', value_robux: 950,   accent: '#7fc6e8', stock: 25 },
  // Common
  { slug: 'starter-blade',     name: 'Starter Blade',     rarity: 'common',    category: 'knife', value_robux: 600,   accent: '#9aa6c4', stock: 40 },
  { slug: 'starter-pistol',    name: 'Starter Pistol',    rarity: 'common',    category: 'gun',   value_robux: 500,   accent: '#9aa6c4', stock: 40 }
];
