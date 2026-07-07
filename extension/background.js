console.log("Background Running");

const API_URL =
  "http://localhost:5000";

/*
========================================
LISTEN FOR CONTENT SCRIPT
========================================
*/

chrome.runtime.onMessage.addListener(

  async (message, sender, sendResponse) => {

    if (message.type === "SAVE_ANIME") {

      try {

        const stored =
          await chrome.storage.local.get(
            ["token"]
          );

        const token =
          stored.token;

        if (!token) {

          console.log(
            "No token — open extension popup to login"
          );

          return;

        }

        const response = await fetch(

          `${API_URL}/api/progress/save`,

          {

            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`
            },

            body: JSON.stringify(
              message.data
            )

          }

        );

        if (!response.ok) {

          console.log(
            "Save failed:",
            response.status
          );

          return;

        }

        const result =
          await response.json();

        console.log(
          "Saved To Backend"
        );

        console.log(result);

      } catch (err) {

        console.log("FETCH ERROR");
        console.log(err);

      }

    }

  }

);
