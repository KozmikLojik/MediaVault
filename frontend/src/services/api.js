import config from "../config";

export const getToken = () =>
  localStorage.getItem("token");

export const getUser = () => {

  const user =
    localStorage.getItem("user");

  return user
    ? JSON.parse(user)
    : null;

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

  localStorage.setItem(
    "token",
    data.token
  );

  localStorage.setItem(
    "user",
    JSON.stringify({
      _id: data._id,
      username: data.username,
      email: data.email
    })
  );

};

export const logout = () => {

  localStorage.removeItem("token");
  localStorage.removeItem("user");

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

  const headers = {
    "Content-Type":
      "application/json",
    ...options.headers,
    ...authHeaders()
  };

  const response = await fetch(
    url,
    {
      ...options,
      headers
    }
  );

  if (response.status === 401) {

    logout();

    window.location.href =
      "/login.html";

    throw new Error(
      "Unauthorized"
    );

  }

  return response;

}

export function initNavAuth() {

  const user = getUser();
  const userEl =
    document.getElementById(
      "nav-user"
    );
  const logoutBtn =
    document.getElementById(
      "logout-btn"
    );

  if (user && userEl) {
    userEl.textContent =
      user.username;
  }

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

  const response = await fetch(
    `${config.API_URL}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Login failed"
    );
  }

  return data;

}

export async function registerUser(
  username,
  email,
  password
) {

  const response = await fetch(
    `${config.API_URL}/api/auth/register`,
    {
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
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Registration failed"
    );
  }

  return data;

}
