const request = require("request");
const fs = require("fs");

request("https://www.youtube.com/watch?v=L_LUpnjgPso", function(
  err,
  res,
  body
) {
  fs.writeFile("result.html", body, err => {
    if (err) console.log(err);
    console.log("write done");
  });
});
