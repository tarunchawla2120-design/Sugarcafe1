import "./Offers.css";

const offers = [
  {
    title: "Buy 1 Get 1 FREE",
    subtitle: "On Selected Pizzas",
    color: "#E53935",
  },
  {
    title: "Coffee @ ₹99",
    subtitle: "Freshly Brewed",
    color: "#6F4E37",
  },
  {
    title: "Burger Combo",
    subtitle: "Only ₹249",
    color: "#FB8C00",
  },
];

function Offers() {
  return (
    <section className="offers">
      <h2>Today's Offers</h2>

      <div className="offer-slider">
        {offers.map((offer, index) => (
          <div
            className="offer-card"
            key={index}
            style={{ background: offer.color }}
          >
            <h3>{offer.title}</h3>
            <p>{offer.subtitle}</p>

            <button>Order Now</button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Offers;