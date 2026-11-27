/* Higuera · carta compartida entre la mesa y el panel del equipo */
window.CARTA = (() => {
  const CATS = [
    { id: "desayunos", es: "Desayunos", en: "Breakfast", pes: "Lo clásico de la mañana, de lo salado a lo dulce.", pen: "Morning classics, savory to sweet." },
    { id: "toasts", es: "Toasts y sándwiches", en: "Toasts & sandwiches", pes: "Pan dorado a la plancha y la sopa de tomate que todos piden.", pen: "Griddled bread and the tomato soup everyone orders." },
    { id: "cafe", es: "Café", en: "Coffee", pes: "Café de especialidad preparado en barra.", pen: "Specialty coffee made at the bar." },
    { id: "bebidas", es: "Otras bebidas", en: "Other drinks", pes: "Para quien no toma café.", pen: "For non-coffee days." },
  ];
  // [nombre, categoría, etiqueta, fotos, sugerencia para acompañar]
  const RAW = [
    ["Chilaquiles verdes", "desayunos", "Clásico", ["chilaquiles-md", "chilaquiles"], "Cold brew"],
    ["Chilaquiles rojos", "desayunos", "", [], "Americano"],
    ["Chilaquiles divorciados", "desayunos", "", [], "Horchata latte"],
    ["Enfrijoladas", "desayunos", "", ["enfrijoladas"], "Americano"],
    ["Enchiladas poblanas", "desayunos", "", [], "Jugo cold press"],
    ["Buttermilk waffles", "desayunos", "Dulce", ["waffle"], "Latte"],
    ["French toast", "desayunos", "Dulce", [], "Cappuccino"],
    ["Morning bun", "desayunos", "Dulce", [], "Flat white"],
    ["Mollete", "desayunos", "", [], "Americano"],
    ["Bowl de fruta con yoghurt", "desayunos", "", [], "Matcha"],
    ["Sopa de tomate", "toasts", "Con grilled cheese", ["sopa-md", "sopa", "sopa-bn"], "Cold brew"],
    ["Scrambled toast", "toasts", "", [], "Flat white"],
    ["Kale avo toast", "toasts", "", [], "Matcha horchata"],
    ["Tostado de pimiento asado con salmón", "toasts", "", [], "Jugo cold press"],
    ["Sándwich de jamones", "toasts", "", [], "Cold brew"],
    ["Sándwich de pastrami", "toasts", "", [], "Americano"],
    ["Cheeseburger", "toasts", "", [], "Cold brew"],
    ["Latte", "cafe", "", ["latte"], "Morning bun"],
    ["Americano", "cafe", "", [], "Mollete"],
    ["Cappuccino", "cafe", "", [], "French toast"],
    ["Flat white", "cafe", "", [], "Morning bun"],
    ["Mocha", "cafe", "", [], "Buttermilk waffles"],
    ["Cold brew", "cafe", "", [], "Chilaquiles verdes"],
    ["Honey lavender latte", "cafe", "De la casa", [], "Buttermilk waffles"],
    ["Horchata latte", "cafe", "De la casa", [], "Chilaquiles divorciados"],
    ["Salted caramel latte", "cafe", "", [], "French toast"],
    ["Matcha", "bebidas", "", [], "Bowl de fruta con yoghurt"],
    ["Matcha horchata", "bebidas", "De la casa", [], "Kale avo toast"],
    ["Chai", "bebidas", "", [], "Morning bun"],
    ["Chocolate", "bebidas", "", [], "French toast"],
    ["Jugo cold press", "bebidas", "", [], "Enchiladas poblanas"],
  ];
  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const ITEMS = RAW.map(([n, cat, tag, photos, pair], i) => ({ id: slug(n), n, cat, tag, photos, pair: slug(pair), no: String(i + 1).padStart(2, "0") }));
  // fotos que el equipo puede elegir para el destacado
  const PHOTOS = [
    ["waffle", "Buttermilk waffle con moras"], ["chilaquiles-xl", "Chilaquiles verdes"], ["sopa-xl", "Sopa de tomate"], ["latte", "Latte"],
    ["enfrijoladas", "Enfrijoladas"], ["postre", "Postre"], ["shakshouka", "Huevos con pan"], ["sandwich", "Sándwich a la plancha"], ["barra-xl", "La barra"], ["interior-xl", "El interior"],
  ];
  return { CATS, ITEMS, PHOTOS, slug };
})();
