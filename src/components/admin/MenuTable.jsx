import "../../css/AdminTable.css";

function MenuTable({ products, onEdit, onDelete, onToggleAvailability }) {
  return (
    <div className="table-card">

      <div className="table-header">
        <h2>🍔 Menu Items</h2>

        <input
          type="text"
          placeholder="🔍 Search menu..."
          className="search-box"
        />
      </div>

      <table className="menu-table">

        <thead>
          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>

          {products.length === 0 ? (
            <tr>
              <td colSpan="5" className="empty">
                No Menu Items Found
              </td>
            </tr>
          ) : (
            products.map((item) => (
              <tr key={item.id}>

                <td>
                  <img
                    src={item.image}
                    alt={item.name}
                    className="food-img"
                  />
                </td>

                <td>{item.name}</td>

                <td>{item.category}</td>

                <td>₹{item.price}</td>

                <td>

                  <button
                    className="edit-btn"
                    onClick={() => onEdit(item)}
                  >
                    ✏️
                  </button>

                  <button className="edit-btn" onClick={() => onToggleAvailability(item.id, item.available !== false)}>{item.available === false ? "🔴 OFF" : "🟢 ON"}</button>

                  <button
                    className="delete-btn"
                    onClick={() => onDelete(item.id)}
                  >
                    🗑️
                  </button>

                </td>

              </tr>
            ))
          )}

        </tbody>

      </table>

    </div>
  );
}

export default MenuTable;