import { useEffect } from "react";
import "./SplashScreen.css";

function SplashScreen({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="splash-screen">
      <img
        src="/cafe.jpeg"
        alt="Sugar Café"
        className="splash-image"
      />
    </div>
  );
}

export default SplashScreen;