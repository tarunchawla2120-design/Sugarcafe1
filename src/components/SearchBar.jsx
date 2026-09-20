import "./SearchBar.css";
import { FaSearch, FaMicrophone } from "react-icons/fa";

function SearchBar({ search, setSearch }) {
  const handleSearchClick = () => {
    const input = document.querySelector(".search-container input");

    if (input) {
      input.focus();
    }
  };

  return (
    <div className="search-wrapper">

      <div className="search-container">

        <button
          type="button"
          className="search-icon-btn"
          onClick={handleSearchClick}
          aria-label="Search"
        >
          <FaSearch className="search-icon" />
        </button>

        <input
          type="text"
          placeholder="Search coffee, pizza, burger..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />

        <FaMicrophone className="mic-icon" />

      </div>

    </div>
  );
}

export default SearchBar;