import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem("sugarCafeCart");
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error("Cart load error:", error);
      return [];
    }
  });

  // Add item
  const addToCart = (item) => {
    setCart((currentCart) => {
      const exist = currentCart.find((x) => x.id === item.id);

      if (exist) {
        return currentCart.map((x) =>
          x.id === item.id
            ? { ...x, qty: x.qty + 1 }
            : x
        );
      }

      return [...currentCart, { ...item, qty: 1 }];
    });
  };

  // Increase quantity
  const increaseQty = (id) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === id
          ? { ...item, qty: item.qty + 1 }
          : item
      )
    );
  };

  // Decrease quantity
  const decreaseQty = (id) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id
            ? { ...item, qty: item.qty - 1 }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  // Remove item
  const removeFromCart = (id) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== id)
    );
  };

  // ⭐ Clear complete cart
  const clearCart = () => {
    setCart([]);
    localStorage.removeItem("sugarCafeCart");
  };

  // Total items
  const totalItems = cart.reduce(
    (total, item) => total + Number(item.qty || 0),
    0
  );

  // Total price
  const totalPrice = cart.reduce(
    (total, item) =>
      total + Number(item.price || 0) * Number(item.qty || 0),
    0
  );

  // Save cart whenever it changes
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
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export default CartProvider;
