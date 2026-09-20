import "./Hero.css";
import banner1 from "../assets/banner1.jpg";

function Hero() {
  return (
    <section className="hero">
      <div className="hero-banner">
        <img
          src={banner1}
          alt="Sugar Cafe"
          className="hero-image"
        />
      </div>
    </section>
  );
}

export default Hero;