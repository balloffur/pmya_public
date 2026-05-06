let score = 0;

const scoreText = document.getElementById("score");
const clickButton = document.getElementById("clickButton");

function render() {
  scoreText.textContent = score;
}

clickButton.addEventListener("click", function () {
  score = score + 1;
  render();
});


render();
