import React, { useState } from "react";

function Categories() {
  const [name, setName] = useState("");
  const [image, setImage] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name || !image) {
      alert("Please fill all fields");
      return;
    }

    alert("Category Ready to Save");
    console.log({
      name,
      image,
    });

    setName("");
    setImage(null);
  };

  return (
    <div style={{ padding: "30px" }}>
      <h1>📂 Categories</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: "450px",
          marginTop: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "15px",
        }}
      >
        <input
          type="text"
          placeholder="Category Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid #ddd",
          }}
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files[0])}
        />

        <button
          type="submit"
          style={{
            padding: "12px",
            background: "#ff7a00",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          Save Category
        </button>
      </form>
    </div>
  );
}

export default Categories;

