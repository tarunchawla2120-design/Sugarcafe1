import { createContext, useContext, useState, useEffect } from "react";



const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
  const savedCart = localStorage.getItem("sugarCafeCart");
  return savedCart ? JSON.parse(savedCart) : [];
});
  

  const addToCart = (item) => {
   console.log("Cart Updated"); 
    const exist = cart.find((x) => x.id === item.id);

    if (exist) {
      setCart(
        cart.map((x) =>
          x.id === item.id
            ? { ...x, qty: x.qty + 1 }
            : x
        )
      );
    } else {
      setCart([...cart, { ...item, qty: 1 }]);
    }
  };

  const increaseQty = (id) => {
    setCart(
      cart.map((item) =>
        item.id === id
          ? { ...item, qty: item.qty + 1 }
          : item
      )
    );
  };

  const decreaseQty = (id) => {
    setCart(
      cart
        .map((item) =>
          item.id === id
            ? { ...item, qty: item.qty - 1 }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const totalItems = cart.reduce((a, b) => a + b.qty, 0);

  const totalPrice = cart.reduce(
    (a, b) => a + b.price * b.qty,
    0
  );
 useEffect(() => {
  localStorage.setItem("sugarCafeCart", JSON.stringify(cart));
}, [cart]); 

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        increaseQty,
        decreaseQty,
        removeFromCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};


export default CartProvider;