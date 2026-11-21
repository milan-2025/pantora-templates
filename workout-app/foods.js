/* ---------- everyday Indian foods: [name, usual serving, kcal, protein g] — rough home-cooked averages ---------- */
const FOODS = [
  ['Roti / chapati', '1 medium', 110, 3], ['Phulka (no ghee)', '1', 80, 3], ['Paratha (plain)', '1', 230, 5], ['Aloo paratha', '1', 300, 6], ['Paneer paratha', '1', 330, 11],
  ['Methi thepla', '1', 120, 3], ['Puri', '1', 120, 2], ['Bhatura', '1', 290, 6], ['Naan', '1', 260, 8], ['Tandoori roti', '1', 150, 5],
  ['Rice (cooked)', '1 bowl (150 g)', 195, 4], ['Brown rice (cooked)', '1 bowl (150 g)', 170, 4], ['Jeera rice', '1 bowl', 240, 4], ['Veg pulao', '1 bowl', 260, 6], ['Veg biryani', '1 plate', 380, 9],
  ['Chicken biryani', '1 plate', 500, 24], ['Curd rice', '1 bowl', 230, 7], ['Khichdi', '1 bowl', 230, 9], ['Lemon rice', '1 bowl', 260, 5], ['Rajma chawal', '1 plate', 420, 15],
  ['Dal (tadka)', '1 katori', 150, 8], ['Dal makhani', '1 katori', 260, 10], ['Rajma', '1 katori', 190, 10], ['Chole', '1 katori', 220, 10], ['Sambar', '1 katori', 130, 6],
  ['Kadhi', '1 katori', 160, 6], ['Moong dal (plain)', '1 katori', 120, 8], ['Sprouts salad', '1 bowl', 120, 9], ['Paneer bhurji', '1 katori', 280, 16], ['Palak paneer', '1 katori', 260, 12],
  ['Paneer butter masala', '1 katori', 360, 13], ['Matar paneer', '1 katori', 280, 12], ['Paneer (raw)', '100 g', 265, 18], ['Tofu', '100 g', 145, 15], ['Soya chunks (cooked)', '1 katori', 150, 15],
  ['Aloo sabzi', '1 katori', 180, 3], ['Bhindi sabzi', '1 katori', 140, 3], ['Mixed veg sabzi', '1 katori', 150, 4], ['Baingan bharta', '1 katori', 140, 3], ['Gobhi sabzi', '1 katori', 130, 4],
  ['Lauki / tinda sabzi', '1 katori', 90, 2], ['Cucumber raita', '1 katori', 80, 4], ['Green salad', '1 plate', 40, 2], ['Curd (dahi)', '1 katori', 100, 6], ['Greek yoghurt', '100 g', 95, 9],
  ['Buttermilk (chaas)', '1 glass', 50, 3], ['Lassi (sweet)', '1 glass', 260, 8], ['Milk (toned)', '1 glass', 120, 6], ['Chai with sugar', '1 cup', 90, 2], ['Chai without sugar', '1 cup', 50, 2],
  ['Black coffee', '1 cup', 5, 0], ['Coffee with milk & sugar', '1 cup', 100, 3], ['Egg (boiled)', '1', 75, 6], ['Egg omelette (2 eggs)', '1', 200, 13], ['Egg bhurji (2 eggs)', '1 plate', 220, 13],
  ['Egg curry', '1 katori (2 eggs)', 260, 14], ['Chicken curry', '1 katori', 280, 25], ['Butter chicken', '1 katori', 420, 26], ['Tandoori chicken', '2 pieces', 260, 32], ['Chicken breast (grilled)', '100 g', 165, 31],
  ['Fish curry', '1 katori', 240, 22], ['Fish fry', '1 piece', 220, 18], ['Mutton curry', '1 katori', 350, 24], ['Prawn curry', '1 katori', 220, 20], ['Chicken tikka', '6 pieces', 270, 34],
  ['Idli', '2', 120, 4], ['Dosa (plain)', '1', 170, 4], ['Masala dosa', '1', 350, 7], ['Uttapam', '1', 220, 6], ['Vada (medu)', '1', 140, 4],
  ['Upma', '1 bowl', 230, 6], ['Poha', '1 plate', 250, 5], ['Besan chilla', '2', 240, 12], ['Moong dal chilla', '2', 220, 14], ['Oats (with milk)', '1 bowl', 260, 10],
  ['Dalia (with milk)', '1 bowl', 220, 8], ['Bread (white)', '2 slices', 140, 4], ['Bread (brown)', '2 slices', 130, 6], ['Peanut butter', '1 tbsp', 95, 4], ['Sandwich (veg)', '1', 260, 8],
  ['Samosa', '1', 260, 4], ['Kachori', '1', 190, 4], ['Pakora', '5 pieces', 250, 5], ['Vada pav', '1', 300, 7], ['Pav bhaji', '1 plate', 450, 10],
  ['Chole bhature', '1 plate', 650, 18], ['Pani puri', '6', 200, 4], ['Bhel puri', '1 plate', 230, 6], ['Maggi / instant noodles', '1 pack', 360, 8], ['Momos (veg, steamed)', '6', 240, 7],
  ['Pizza', '1 slice', 280, 11], ['Burger (veg)', '1', 400, 11], ['French fries', 'medium', 360, 4], ['Banana', '1', 105, 1], ['Apple', '1', 95, 0],
  ['Orange', '1', 60, 1], ['Papaya', '1 bowl', 60, 1], ['Mango', '1', 200, 3], ['Watermelon', '1 bowl', 45, 1], ['Guava', '1', 70, 3],
  ['Almonds', '10', 70, 3], ['Peanuts (roasted)', '1 handful', 170, 7], ['Roasted chana', '1 handful', 120, 7], ['Makhana (roasted)', '1 bowl', 110, 4], ['Mixed nuts', '1 handful', 170, 5],
  ['Dates', '2', 130, 1], ['Gulab jamun', '1', 150, 2], ['Rasgulla', '1', 120, 2], ['Jalebi', '2 pieces', 300, 2], ['Kheer', '1 katori', 230, 6],
  ['Halwa (sooji)', '1 katori', 300, 4], ['Ladoo (besan)', '1', 180, 3], ['Dark chocolate', '2 squares', 110, 2], ['Biscuits', '4', 160, 2], ['Namkeen', '1 handful', 160, 4],
  ['Whey protein', '1 scoop', 120, 24], ['Protein bar', '1', 200, 15], ['Coconut water', '1', 45, 1], ['Fresh juice', '1 glass', 120, 1], ['Cold drink / soda', '1 can', 140, 0],
  ['Beer', '1 pint', 210, 2], ['Ghee', '1 tsp', 45, 0], ['Butter', '1 tsp', 35, 0],
];
const FOOD_INDEX = FOODS.map((f, i) => ({ i, n: f[0], key: f[0].toLowerCase() }));
function searchFoods(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return FOOD_INDEX.filter((f) => words.every((w) => f.key.includes(w))).sort((a, b) => a.key.indexOf(words[0]) - b.key.indexOf(words[0])).slice(0, 8).map((f) => FOODS[f.i]);
}
