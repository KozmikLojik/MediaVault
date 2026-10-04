import config from "../config";

export const getToken = () => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

export const getUser = () => {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

export const authHeaders = () => {

  const token = getToken();

  if (!token) {
    return {};
  }

  return {
    Authorization:
      `Bearer ${token}`
  };

};

export const saveAuth = (data) => {
  try {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify({
      _id: data._id,
      username: data.username,
      email: data.email
    }));
  } catch {
    logout();
    throw new Error("Sign-in worked, but this browser could not save the session. Enable site storage and try again.");
  }

};

export const logout = () => {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {
    // The current page still redirects on logout when storage is restricted.
  }

};

export const requireAuth = () => {

  if (!getToken()) {
    window.location.href =
      "/login.html";
    return false;
  }

  return true;

};

export async function fetchWithAuth(
  url,
  options = {}
) {

  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const auth = authHeaders();
  if (auth.Authorization) headers.set("Authorization", auth.Authorization);

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error("MediaVault could not reach the API. Your data is safe; public browsing is still available from Home.");
  }

  if (response.status === 401) {
    if (getToken()) {
      logout();
      window.location.href = "/login.html";
      throw new Error("Your session expired. Please sign in again.");
    }

  }

  return response;

}

export function initNavAuth() {

  const user = getUser();
  const userElements =
    document.querySelectorAll(
      ".nav-user, #profile-user"
    );
  const logoutBtn =
    document.getElementById(
      "logout-btn"
    );
  const loginLink = document.getElementById("login-link");
  const registerLink = document.getElementById("register-link");

  if (user) {
    userElements.forEach((element) => {
      element.textContent = user.username;
    });
  }

  const signedIn = Boolean(getToken());
  if (loginLink) loginLink.hidden = signedIn;
  if (registerLink) registerLink.hidden = signedIn;
  if (logoutBtn) logoutBtn.hidden = !signedIn;
  userElements.forEach((element) => { element.hidden = !user; });

  if (logoutBtn) {

    logoutBtn.addEventListener(
      "click",
      (e) => {

        e.preventDefault();

        logout();

        window.location.href =
          "/login.html";

      }
    );

  }

}

export async function loginUser(
  email,
  password
) {

  let response;
  try {
    response = await fetch(`${config.API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });
  } catch {
    throw new Error("The sign-in service is unavailable right now. You can still browse the public preview from Home.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Login failed"
    );
  }

  if (!data.token) throw new Error("The server did not return a sign-in token.");

  return data;

}

export async function registerUser(
  username,
  email,
  password
) {

  let response;
  try {
    response = await fetch(`${config.API_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        username,
        email,
        password
      })
    });
  } catch {
    throw new Error("The sign-up service is unavailable right now. You can still browse the public preview from Home.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Registration failed"
    );
  }

  if (!data.token) throw new Error("The server did not return a sign-in token.");

  return data;

}
