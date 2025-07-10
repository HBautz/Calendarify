console.log("Testing token verification...");
const token = localStorage.getItem("calendarify-token");
console.log("Token exists:", !!token);
if (token) {
  fetch("http://localhost:3001/api/users/me", {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(res => {
    console.log("Response status:", res.status);
    return res.text();
  })
  .then(text => {
    console.log("Response body:", text);
  })
  .catch(err => {
    console.error("Fetch error:", err);
  });
}
