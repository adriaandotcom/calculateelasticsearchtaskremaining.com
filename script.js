const sanitizeJsonInput = (input) => {
  // Remove triple double quotes
  input = input.replace(/"""/g, '"');

  // Remove comments and handle multiline strings by stripping newlines
  input = input.replace(/\/\/.*$/gm, ""); // Remove single-line comments
  input = input.replace(/\n/g, " "); // Replace newlines with a space

  return input;
};

const calculateTimeRemaining = () => {
  const jsonInput = document.getElementById("json-input").value;
  const sanitizedInput = sanitizeJsonInput(jsonInput);
  const resultElement = document.getElementById("result");

  try {
    let data;

    try {
      data = JSON.parse(sanitizedInput);
    } catch (error) {
      console.error(error);
      resultElement.textContent =
        "Invalid JSON input. Please check your format.";
      return;
    }

    const { completed, task } = data;

    if (completed) {
      resultElement.textContent = "Task is already completed.";
      return;
    }

    const { status, running_time_in_nanos } = task;
    const { total, created = 0, updated = 0, deleted = 0 } = status;

    // Calculate the number of documents processed
    const processed = created + updated + deleted;

    if (total === 0 || processed === 0) {
      resultElement.textContent =
        "Insufficient data to calculate remaining time.";
      return;
    }

    const progress = processed / total;

    // Calculate elapsed time in milliseconds
    const elapsedTimeMillis = running_time_in_nanos / 1e6;

    // Estimate remaining time
    const estimatedTotalTimeMillis = elapsedTimeMillis / progress;
    const remainingTimeMillis = estimatedTotalTimeMillis - elapsedTimeMillis;

    // Calculate estimated end time
    const currentTime = Date.now();
    const estimatedEndTime = new Date(currentTime + remainingTimeMillis);

    // Format remaining time
    const remainingSeconds = Math.floor(remainingTimeMillis / 1000);
    const days = Math.floor(remainingSeconds / (3600 * 24));
    const hours = Math.floor((remainingSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    let remainingTimeString = "Estimated remaining time: ";
    if (days > 0) remainingTimeString += `${days}d `;
    if (hours > 0 || days > 0) remainingTimeString += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0)
      remainingTimeString += `${minutes}m `;
    remainingTimeString += `${seconds}s`;

    const endTimeString = `Estimated end time: ${estimatedEndTime.toLocaleString()}`;

    resultElement.textContent = `${remainingTimeString}\n${endTimeString}`;
  } catch (error) {
    console.error(error);
    resultElement.textContent = error.message;
  }
};

document
  .getElementById("calculate-button")
  .addEventListener("click", calculateTimeRemaining);
