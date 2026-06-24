console.log("Background Running");

/*
========================================
LISTEN FOR CONTENT SCRIPT
========================================
*/

chrome.runtime.onMessage.addListener(

  async (message, sender, sendResponse) => {

    console.log("MESSAGE RECEIVED");

    console.log(message);

    if (message.type === "SAVE_ANIME") {

      try {

        const response = await fetch(

          "http://localhost:5000/api/progress/save",

          {

            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify(message.data)

          }

        );

        const result = await response.json();

        console.log("Saved To Backend");

        console.log(result);

      } catch (err) {

        console.log("FETCH ERROR");

        console.log(err);

      }
    }
  }
);