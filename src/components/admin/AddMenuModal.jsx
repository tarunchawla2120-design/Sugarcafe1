import "../../css/AdminModal.css";

function AddMenuModal({
  show,
  onClose,
  onSave,
  itemName,
  setItemName,
  price,
  setPrice,
  category,
  setCategory,
  description,
  setDescription,
  image,
  setImage,
  categories,
  editingId,
}) {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="admin-modal">

        <h2>{editingId ? "Edit Menu Item" : "Add Menu Item"}</h2>

        <input
          type="text"
          placeholder="Item Name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />

        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Select Category</option>

          {categories
  .filter((cat) => cat.name && cat.name.trim() !== "")
  .map((cat) => (
    <option key={cat.id} value={cat.name}>
      {cat.name}
    </option>
  ))}

        </select>

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="text"
          placeholder="Image URL"
          value={image}
          onChange={(e) => setImage(e.target.value)}
        />

        {image && (
          <div className="preview">
            <img src={image} alt="Preview" />
          </div>
        )}

        <div className="modal-buttons">
          <button className="save-btn" onClick={onSave}>
            Save
          </button>

          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}

export default AddMenuModal;