import {
  registerUser,
  saveAuth,
  getToken
} from "./services/api";
import "./style.css";

if (getToken()) {
  window.location.href = "/";
}

const form =
  document.getElementById(
    "register-form"
  );

const errorEl =
  document.getElementById("auth-error");

const submitBtn =
  document.getElementById("submit-btn");

form.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();

    errorEl.textContent = "";
    submitBtn.disabled = true;
    submitBtn.textContent =
      "Creating account...";

    const username =
      document.getElementById(
        "username"
      ).value.trim();

    const email =
      document.getElementById(
        "email"
      ).value.trim();

    const password =
      document.getElementById(
        "password"
      ).value;

    try {

      const data =
        await registerUser(
          username,
          email,
          password
        );

      saveAuth(data);

      window.location.href = "/";

    } catch (err) {

      errorEl.textContent =
        err.message;

    }

    submitBtn.disabled = false;
    submitBtn.textContent =
      "Register";

  }
);
