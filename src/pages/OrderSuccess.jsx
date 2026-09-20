import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./OrderSuccess.css";

function OrderSuccess() {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  useEffect(() => {
    setOrderNumber(localStorage.getItem("lastOrderNumber") || "");
    setPaymentStatus(localStorage.getItem("lastOrderPaymentStatus") || "");
  }, []);

  return (
    <div className="success-page">
      <div className="success-card">
        <div className="success-icon">✅</div>

        <h2>Order Placed!</h2>

        <p>
          Thank you for your order.
          <br />
          Your delicious food is being prepared.
        </p>

        {orderNumber && (
          <div style={{ margin: "16px 0", padding: "12px", borderRadius: "12px", background: "#fff7ed" }}>
            <strong>{orderNumber}</strong>
            {paymentStatus && <div style={{ marginTop: "6px", fontSize: "13px", color: "#666" }}>Payment: {paymentStatus}</div>}
          </div>
        )}

        <button
          className="home-btn"
          onClick={() => navigate("/orders")}
        >
          Track My Order
        </button>

        <button
          className="home-btn"
          style={{ marginTop: "10px", background: "#fff", color: "#ff6b35", border: "1px solid #ff6b35" }}
          onClick={() => navigate("/home")}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default OrderSuccess;