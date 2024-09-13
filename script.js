let intervalId;

const sanitizeJsonInput = (input) => {
  input = input.replace(/"""/g, '"');
  input = input.replace(/\/\/.*$/gm, "");
  input = input.replace(/\n/g, " ");
  return input;
};

const parseJsonInput = (sanitizedInput) => {
  try {
    return JSON.parse(sanitizedInput);
  } catch (error) {
    console.error("JSON parse error", JSON.stringify(error, null, 2));
    throw new Error("Invalid JSON input. Please check your format.");
  }
};

const extractTaskData = ({ completed, task }) => {
  if (completed) {
    throw new Error("Task is already completed.");
  }
  const { status, start_time_in_millis, running_time_in_nanos, id } = task;
  const {
    total,
    created = 0,
    updated = 0,
    deleted = 0,
    version_conflicts = 0,
  } = status;
  return {
    total,
    processed: created + updated + deleted + version_conflicts,
    start_time_in_millis,
    running_time_in_nanos,
    task_id: id,
  };
};

const calculateProgress = (data, currentTime) => {
  const { total, processed, start_time_in_millis, running_time_in_nanos } =
    data;

  if (total === 0 || processed === 0) {
    throw new Error("Insufficient data to calculate remaining time.");
  }

  const runningTimeMillis = running_time_in_nanos / 1000000;
  const rate = processed / runningTimeMillis; // docs per millisecond

  const elapsedSinceStart = currentTime - start_time_in_millis;
  const estimatedProcessed = rate * elapsedSinceStart;
  const remainingDocs = total - estimatedProcessed;
  const estimatedRemainingTimeMillis = remainingDocs / rate;

  return {
    estimatedProcessed,
    progress: estimatedProcessed / total,
    rate,
    estimatedRemainingTimeMillis,
    currentTime,
  };
};

const formatRemainingTime = (remainingTimeMillis) => {
  const remainingSeconds = Math.floor(remainingTimeMillis / 1000);
  const days = Math.floor(remainingSeconds / (3600 * 24));
  const hours = Math.floor((remainingSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  let remainingTimeString = "Estimated remaining time: ";

  if (remainingTimeMillis <= 0) {
    return `${remainingTimeString}0s`;
  }

  if (days > 0) remainingTimeString += `${days}d `;
  if (hours > 0 || days > 0) remainingTimeString += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0)
    remainingTimeString += `${minutes}m `;
  remainingTimeString += `${seconds}s`;

  return remainingTimeString;
};

const formatEndTime = (estimatedEndTimeMillis) => {
  const estimatedEndTime = new Date(estimatedEndTimeMillis);
  return `Estimated end time: ${estimatedEndTime.toLocaleString()}`;
};

const updateFavicon = (progress) => {
  const dashoffset = 100 - progress;

  const waiting = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#871ea1" d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm1 12v-6h-2v8h7v-2h-5z"/></svg>`;

  const finishedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#871ea1" d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm4.393 7.5l-5.643 5.784-2.644-2.506-1.856 1.858 4.5 4.364 7.5-7.643-1.857-1.857z"/></svg>`;

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'>
        <circle cx='18' cy='18' r='15.91549431' fill='none' stroke='#eccdf3' stroke-width='4'/>
        <circle cx='18' cy='18' r='15.91549431' fill='none' stroke='#871ea1' stroke-width='4' stroke-dasharray='100' stroke-dashoffset='${dashoffset}' transform='rotate(-90 18 18)'/>
        <text x='18' y='22' font-size='14' text-anchor='middle' fill='#333' font-family='Arial'>${progress}</text>
      </svg>`;

  const useSvg =
    progress === -1 ? waiting : progress >= 100 ? finishedSvg : svg;

  const encodedSvg = encodeURIComponent(useSvg);
  const favicon = document.querySelector("link[rel='icon']");
  favicon.setAttribute("href", `data:image/svg+xml,${encodedSvg}`);
};

updateFavicon(-1);

const updateResult = (resultElement, progressData, taskData) => {
  const { estimatedRemainingTimeMillis, currentTime, estimatedProcessed } =
    progressData;
  const { total, processed, task_id } = taskData;

  const remainingTimeString = formatRemainingTime(estimatedRemainingTimeMillis);
  const estimatedEndTimeMillis = currentTime + estimatedRemainingTimeMillis;
  const endTimeString = formatEndTime(estimatedEndTimeMillis);

  let estimatedProgressPercentage = (estimatedProcessed / total) * 100;
  if (estimatedProgressPercentage > 100) estimatedProgressPercentage = 100;

  // Update document title
  document.title = `${estimatedProgressPercentage.toFixed(0)}% ${task_id}`;

  updateFavicon(estimatedProgressPercentage.toFixed(0));

  resultElement.textContent = `${remainingTimeString}\n${endTimeString}\nActual progress: ${processed} / ${total} (${(
    (processed / total) *
    100
  ).toFixed(2)}%)\nEstimated progress: ${Math.floor(
    estimatedProcessed > total ? total : estimatedProcessed
  )} / ${total} (${estimatedProgressPercentage.toFixed(2)}%)`;
};

const calculateTimeRemaining = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  const jsonInput = document.getElementById("json-input").value;
  const sanitizedInput = sanitizeJsonInput(jsonInput);
  const resultElement = document.getElementById("result");

  try {
    const data = parseJsonInput(sanitizedInput);
    const taskData = extractTaskData(data);

    const updateDisplay = () => {
      const currentTime = Date.now();
      const progressData = calculateProgress(taskData, currentTime);

      // Check if the task is estimated to be complete
      if (progressData.estimatedProcessed >= taskData.total) {
        clearInterval(intervalId);
        intervalId = null;

        // Optionally update the display one last time
        updateResult(resultElement, progressData, taskData);

        // Update the display to indicate completion
        resultElement.textContent += `\nTask is estimated to be complete.`;
        return;
      }

      updateResult(resultElement, progressData, taskData);
    };

    updateDisplay(); // Initial update

    intervalId = setInterval(updateDisplay, 1000);

    window.addEventListener("unload", () => clearInterval(intervalId));
  } catch (error) {
    console.error("Calculation error", JSON.stringify(error, null, 2));
    resultElement.textContent = error.message;
  }
};

document
  .getElementById("calculate-button")
  .addEventListener("click", calculateTimeRemaining);
