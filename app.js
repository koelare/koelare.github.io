// app.js - Unified script for your personal app

/********** Start Page Logic **********/
const endpoints = {
  europatipset: "https://api.spela.svenskaspel.se/draw/1/europatipset/draws/",
  stryktipset: "https://api.spela.svenskaspel.se/draw/1/stryktipset/draws/",
  topptipset: "https://api.spela.svenskaspel.se/draw/1/topptipsetfamily/draws/"
};

function enableButton(buttonId) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.disabled = false;
  }
}

function disableButton(buttonId) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.disabled = true;
  }
}

function checkApiAndUpdate(buttonId, url) {
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    })
    .then(data => {
      // Enable button if there's at least one draw with events.
      if (data && data.draws && data.draws.length > 0 && data.draws[0].drawEvents && data.draws[0].drawEvents.length > 0) {
        enableButton(buttonId);
      } else {
        disableButton(buttonId);
      }
    })
    .catch(error => {
      console.error(`Error fetching data for ${buttonId}:`, error);
      disableButton(buttonId);
    });
}

function setupButtonClicks() {
  const buttons = document.querySelectorAll("button[data-url]");
  buttons.forEach(button => {
    button.addEventListener("click", function () {
      if (!button.disabled) {
        window.location.href = button.getAttribute("data-url");
      }
    });
  });
}

/********** Round Data & Global Variables **********/
let totalEvents = 0;       // Total number of events in the current round.
let selectedHalf = null;   // User-selected number of half hedges.
let selectedFull = null;   // User-selected number of full hedges.

function loadRoundData() {
  // Choose endpoint based on URL.
  let endpoint = "";
  const path = window.location.pathname.toLowerCase();
  if (path.includes("europatipset")) {
    endpoint = endpoints.europatipset;
  } else if (path.includes("stryktipset")) {
    endpoint = endpoints.stryktipset;
  } else if (path.includes("topptipset")) {
    endpoint = endpoints.topptipset;
  } else {
    return; // Not a recognized game page.
  }

  fetch(endpoint)
    .then(response => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    })
    .then(data => {
      const currentRound = data.draws[0];
      const turnover = parseInt(currentRound.currentNetSale);
      const productName = currentRound.productName;
      const isStrykOrEuropa = (productName === "Stryktipset" || productName === "Europatipset");
      const netPot = isStrykOrEuropa
        ? turnover * 0.65 * (1 - 0.08)
        : turnover * 0.725 * (1 - 0.25);
      const jackpot = 0; // Adjust if your API provides a jackpot value.
      const payout = isStrykOrEuropa ? netPot * 0.40 + jackpot : netPot + jackpot;

      // Inject the round info into the DOM.
      const roundInfoEl = document.getElementById("roundInfo");
      if (roundInfoEl) {
        roundInfoEl.innerHTML = `
          <div class="cell split"><p>${productName}</p><p>${currentRound.drawNumber}</p></div>
          <div class="cell split"><p>Turnover</p><p>${turnover} kr</p></div>
          <div class="cell split"><p>Net Pot</p><p>${netPot.toFixed(2)} kr</p></div>
          <div class="cell split"><p>Payout</p><p>${payout.toFixed(2)} kr</p></div>
          <div class="cell split"><p>Jackpot</p><p>${jackpot} kr</p></div>
        `;
      }

      // Store global data for system calculations.
      window.currentTurnover = turnover;
      window.currentEvents = currentRound.drawEvents.map(draw => {
        return {
          eventDescription: draw.eventDescription,
          eventNumber: draw.eventNumber,
          probability: [
            draw.favouriteOdds
              ? parseFloat(draw.favouriteOdds.one) / 100
              : parseFloat(draw.svenskaFolket.one) / 100,
            draw.favouriteOdds
              ? parseFloat(draw.favouriteOdds.x) / 100
              : parseFloat(draw.svenskaFolket.x) / 100,
            draw.favouriteOdds
              ? parseFloat(draw.favouriteOdds.two) / 100
              : parseFloat(draw.svenskaFolket.two) / 100
          ],
          svenskaFolket: [
            parseFloat(draw.svenskaFolket.one) / 100,
            parseFloat(draw.svenskaFolket.x) / 100,
            parseFloat(draw.svenskaFolket.two) / 100
          ]
        };
      });
      
      // Set totalEvents based on the number of draw events.
      totalEvents = currentRound.drawEvents.length;
      // Now create the hedge selection buttons.
      createHedgeButtons(totalEvents);
    })
    .catch(error => {
      console.error("Error loading round data:", error);
      const roundInfoEl = document.getElementById("roundInfo");
      if (roundInfoEl) {
        roundInfoEl.innerHTML = "<p>Error loading round data.</p>";
      }
    });
}

/********** Hedge Button Generation & Updates **********/

// Create two sets of buttons (for half and full hedges) as regular <button> elements.
// Each button is labeled with its numeric value.
function createHedgeButtons(n) {
  const halfContainer = document.getElementById("halfHedgesContainer");
  const fullContainer = document.getElementById("fullHedgesContainer");
  if (!halfContainer || !fullContainer) return;

  // Clear previous content.
  halfContainer.innerHTML = "";
  fullContainer.innerHTML = "";
  selectedHalf = null;
  selectedFull = null;

  // Generate half-hedge buttons from 0 to n.
  for (let i = 0; i <= n; i++) {
    const btn = document.createElement("button");
    btn.classList.add("cell-button"); // Style this in your CSS as needed.
    btn.textContent = i.toString();
    btn.dataset.value = i;
    btn.addEventListener("click", () => {
      selectedHalf = i;
      markSelection(halfContainer, i);
      updateFullHedgeButtons(n);
      updateHalfHedgeButtons(n);
      updatePriceDisplay();
    });
    halfContainer.appendChild(btn);
  }

  // Generate full-hedge buttons from 0 to n.
  for (let j = 0; j <= n; j++) {
    const btn = document.createElement("button");
    btn.classList.add("cell-button");
    btn.textContent = j.toString();
    btn.dataset.value = j;
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      selectedFull = j;
      markSelection(fullContainer, j);
      updateHalfHedgeButtons(n);
      updatePriceDisplay();
    });
    fullContainer.appendChild(btn);
  }
  
  // Initial update for both sets.
  updateFullHedgeButtons(n);
  updateHalfHedgeButtons(n);

  // Set default selection to 0 for both.
  selectedHalf = 0;
  selectedFull = 0;
  markSelection(halfContainer, 0);
  markSelection(fullContainer, 0);
  updateFullHedgeButtons(n);
  updateHalfHedgeButtons(n);
  updatePriceDisplay();

  
  // Create the "Calculate" button.
  createCalculateButton();
}

// Highlight the selected button in a container and unhighlight others.
function markSelection(container, selectedValue) {
  const buttons = container.querySelectorAll("button.cell-button");
  buttons.forEach(btn => {
    if (parseInt(btn.dataset.value, 10) === selectedValue) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

// Disable full-hedge buttons where (selectedHalf + full value) > totalEvents.
function updateFullHedgeButtons(n) {
  const fullContainer = document.getElementById("fullHedgesContainer");
  if (!fullContainer) return;
  const buttons = fullContainer.querySelectorAll("button.cell-button");
  buttons.forEach(btn => {
    const fullVal = parseInt(btn.dataset.value, 10);
    if (selectedHalf !== null && (selectedHalf + fullVal > n)) {
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  });
}

// Optionally, disable half-hedge buttons if (half + selectedFull) > totalEvents.
function updateHalfHedgeButtons(n) {
  const halfContainer = document.getElementById("halfHedgesContainer");
  if (!halfContainer) return;
  const buttons = halfContainer.querySelectorAll("button.cell-button");
  buttons.forEach(btn => {
    const halfVal = parseInt(btn.dataset.value, 10);
    if (selectedFull !== null && (halfVal + selectedFull > n)) {
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  });
}

// Update the displayed price based on selectedHalf and selectedFull.
// Price is calculated as 2^(selectedHalf) * 3^(selectedFull).
function updatePriceDisplay() {
  const priceContainer = document.getElementById("priceDisplay");
  if (priceContainer) {
    if (selectedHalf !== null && selectedFull !== null) {
      const price = Math.pow(2, selectedHalf) * Math.pow(3, selectedFull);
      priceContainer.textContent = `${price} KR`;
    } else {
      priceContainer.textContent = "N/A";
    }
  }
}

// Create a separate "Calculate" button in the container with ID "calcContainer".
function createCalculateButton() {
  const calcContainer = document.getElementById("calcContainer");
  if (!calcContainer) return;
  calcContainer.innerHTML = ""; // Clear previous content.
  const calcBtn = document.createElement("button");
  calcBtn.textContent = "Calculate";
  calcBtn.addEventListener("click", () => {
    // Only proceed if both selections are made.
    if (selectedHalf === null || selectedFull === null) {
      alert("Please select both half and full hedge values.");
      return;
    }
    // Check if the selection is valid.
    if (selectedHalf + selectedFull > totalEvents) {
      alert("Invalid selection: total hedges exceed the number of events.");
      return;
    }
    const systemOutputEl = document.getElementById("systemOutput");
    if (systemOutputEl) {
      systemOutputEl.innerHTML = "<p>Calculating optimal system, please wait...</p>";
    }
    // Disable the hedge button containers during calculation.
    const halfContainer = document.getElementById("halfHedgesContainer");
    const fullContainer = document.getElementById("fullHedgesContainer");
    if (halfContainer) halfContainer.style.pointerEvents = "none";
    if (fullContainer) fullContainer.style.pointerEvents = "none";
    setTimeout(() => {
      calculateOptimalSystem(selectedHalf, selectedFull);
      if (halfContainer) halfContainer.style.pointerEvents = "auto";
      if (fullContainer) fullContainer.style.pointerEvents = "auto";
    }, 50);
  });
  calcContainer.appendChild(calcBtn);
}

/********** System Optimization Logic **********/
// Returns all combinations from an array of arrays.
function combinations(arrays) {
  return arrays.reduce((acc, curr) => {
    let newAcc = [];
    acc.forEach(prefix => {
      curr.forEach(value => {
        newAcc.push(prefix + value);
      });
    });
    return newAcc;
  }, [""]);
}

// Quick EV calculation for an outcome string.
function calculateE_normal_modified(y, probabilities, N) {
  const g = y.length;
  const s = [];
  let A_y = 1;
  let P_y = 1;
  for (let i = 0; i < g; i++) {
    if (y[i] === "1") {
      s.push(probabilities[i].svenskaFolket[0]);
      A_y *= probabilities[i].odds[0];
      P_y *= probabilities[i].svenskaFolket[0];
    } else if (y[i] === "X") {
      s.push(probabilities[i].svenskaFolket[1]);
      A_y *= probabilities[i].odds[1];
      P_y *= probabilities[i].svenskaFolket[1];
    } else if (y[i] === "2") {
      s.push(probabilities[i].svenskaFolket[2]);
      A_y *= probabilities[i].odds[2];
      P_y *= probabilities[i].svenskaFolket[2];
    } else {
      s.push(0);
    }
  }
  const muY = s.reduce((acc, prob) => acc + prob, 0);
  const varianceY = s.reduce((acc, prob) => acc + prob * (1 - prob), 0);
  const m = g;
  function m_star() {
    return (m - muY) / Math.sqrt(varianceY);
  }
  function phi(t) {
    return Math.exp(-t * t / 2) / Math.sqrt(2 * Math.PI);
  }
  function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const a1 = 0.254829592,
          a2 = -0.284496736,
          a3 = 1.421413741,
          a4 = -1.453152027,
          a5 = 1.061405429,
          p = 0.3275911;
    const t = 1 / (1 + p * x);
    const yVal = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * yVal;
  }
  function Phi(x) {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
  }
  function integrate(f, a, b, n) {
    if (n % 2 !== 0) n++;
    const h = (b - a) / n;
    let sum = f(a) + f(b);
    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      sum += (i % 2 === 0 ? 2 : 4) * f(x);
    }
    return (h / 3) * sum;
  }
  function integrand(t) {
    const mStar = m_star();
    const term1 = Math.pow(Phi(0.5 + mStar), N + 1);
    const term2 = Math.pow(Phi(-0.5 + mStar), N + 1);
    const term3 = Phi(0.5 + mStar);
    const term4 = Phi(-0.5 + mStar);
    return (term1 - term2 - term3 + term4) * phi(t);
  }
  const L = 6;
  const approxE = integrate(integrand, -L, L, 1000);
  const ratio = P_y === 0 ? 0 : A_y / P_y;
  return ratio * approxE;
}

// Returns a deep copy of the current system and types.
function cloneState(system, types) {
  return {
    system: system.map(arr => arr.slice()),
    types: types.slice()
  };
}

// Generate a random neighbor state.
function randomNeighbor(system, types, n, halfHedges, fullHedges, type1Options, type2Options, type3Option) {
  let newState = cloneState(system, types);
  if (Math.random() < 0.5) {
    let i = Math.floor(Math.random() * n);
    let currentType = newState.types[i];
    if (currentType === 3) return newState;
    let options = (currentType === 1) ? type1Options : type2Options;
    let currentOption = newState.system[i];
    let available = options.filter(opt => JSON.stringify(opt) !== JSON.stringify(currentOption));
    if (available.length > 0) {
      let newOption = available[Math.floor(Math.random() * available.length)];
      newState.system[i] = newOption;
    }
  } else {
    let i = Math.floor(Math.random() * n);
    let j = Math.floor(Math.random() * n);
    while (j === i) {
      j = Math.floor(Math.random() * n);
    }
    let temp = newState.types[i];
    newState.types[i] = newState.types[j];
    newState.types[j] = temp;
    let pickForType = function(type) {
      if (type === 1) {
        return type1Options[Math.floor(Math.random() * type1Options.length)];
      } else if (type === 2) {
        return type2Options[Math.floor(Math.random() * type2Options.length)];
      } else {
        return type3Option.slice();
      }
    };
    newState.system[i] = pickForType(newState.types[i]);
    newState.system[j] = pickForType(newState.types[j]);
    let countType2 = newState.types.filter(t => t === 2).length;
    let countType3 = newState.types.filter(t => t === 3).length;
    if (countType2 !== halfHedges || countType3 !== fullHedges) {
      return cloneState(system, types);
    }
  }
  return newState;
}

// Compute the system's EV by generating all outcome combinations.
function computeSystemEV(system, events, turnover) {
  let rowCombos = combinations(system);
  let sum = 0;
  let eventData = events.map(e => ({
    odds: e.probability,
    svenskaFolket: e.svenskaFolket
  }));
  rowCombos.forEach(row => {
    sum += calculateE_normal_modified(row, eventData, turnover);
  });
  return sum;
}

// Calculate and display the optimal system using the given number of half and full hedges.
function calculateOptimalSystem(halfHedges, fullHedges) {
  if (!window.currentEvents || !window.currentTurnover) {
    alert("Round data not loaded yet.");
    return;
  }
  
  let events = window.currentEvents;
  let n = events.length;
  let outcomes = ["1", "X", "2"];
  let type1Options = [["1"], ["X"], ["2"]];
  let type2Options = [["1", "X"], ["1", "2"], ["X", "2"]];
  let type3Option = ["1", "X", "2"];
  
  // Build an initial system: choose the outcome with the highest probability.
  let initialSystem = events.map(e => {
    let p = e.probability;
    let bestIdx = 0;
    for (let j = 1; j < 3; j++) {
      if (p[j] > p[bestIdx]) bestIdx = j;
    }
    return [outcomes[bestIdx]];
  });
  
  let currentTypes = new Array(n).fill(1);
  // Apply full hedges.
  for (let i = 0; i < n && i < fullHedges; i++) {
    currentTypes[i] = 3;
    initialSystem[i] = type3Option.slice();
  }
  // Apply half hedges.
  let halfCount = 0;
  for (let i = fullHedges; i < n && halfCount < halfHedges; i++) {
    currentTypes[i] = 2;
    initialSystem[i] = type2Options[0].slice();
    halfCount++;
  }
  
  let currentSystem = initialSystem.map(arr => arr.slice());
  let maxIterations = 1000;
  let temperature = 1.0;
  let coolingRate = 0.995;
  
  let currentState = cloneState(currentSystem, currentTypes);
  let currentEV = computeSystemEV(currentState.system, events, window.currentTurnover);
  let bestState = cloneState(currentState.system, currentState.types);
  let bestEV = currentEV;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    temperature *= coolingRate;
    let neighbor = randomNeighbor(currentState.system, currentState.types, n, halfHedges, fullHedges, type1Options, type2Options, type3Option);
    let neighborEV = computeSystemEV(neighbor.system, events, window.currentTurnover);
    let delta = neighborEV - currentEV;
    if (delta > 0 || Math.exp(delta / temperature) > Math.random()) {
      currentState = neighbor;
      currentEV = neighborEV;
      if (currentEV > bestEV) {
        bestState = cloneState(currentState.system, currentState.types);
        bestEV = currentEV;
      }
    }
  }
  
  console.log("Best system EV found:", bestEV);
  
  let outputHTML = "";
  outputHTML += "<div class='table'>";
  for (let i = 0; i < n; i++) {
    outputHTML += `<div class='cell split'><p>${events[i].eventNumber}. ${events[i].eventDescription}</p><p>${bestState.system[i].join("")}</p></div>`;
  }
  outputHTML += `<div class='cell split'><p>EV</p> <p>${bestEV.toFixed(2)}</p></div>`;
  outputHTML += "</div>";

  
  let systemOutputEl = document.getElementById("systemOutput");
  if (systemOutputEl) {
    systemOutputEl.innerHTML = outputHTML;
  }
}

/********** Initialization **********/
document.addEventListener("DOMContentLoaded", () => {
  // Initialize start-page buttons if present.
  if (document.querySelector("button[data-url]")) {
    for (const buttonId in endpoints) {
      if (endpoints.hasOwnProperty(buttonId)) {
        checkApiAndUpdate(buttonId, endpoints[buttonId]);
      }
    }
    setupButtonClicks();
  }
  
  // Load round data if element exists.
  if (document.getElementById("roundInfo")) {
    loadRoundData();
  }
});
