// CONFIGURATION: Put your real Supabase credentials inside these quotes!
const SUPABASE_URL = "https://ewxfsfvqhqqsnpqskvwc.supabase.co/rest/v1/"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eGZzZnZxaHFxc25wcXNrdndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NTc1NjQsImV4cCI6MjEwNjIzMzU2NH0.X0rEtYNQDfnoG-XB7m2xbI81SZ872XRp_OWvCmFFf6w";

// Initialize Supabase directly without string validation rules
let _supabase = null;
try {
    // Only attempt connection if you have actually modified the string values
    if (SUPABASE_URL && SUPABASE_URL !== "") {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.error("Supabase failed to initialize:", e);
}
const form = document.getElementById('evalForm');
if (document.getElementById('date')) {
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
}

const trackingPage = document.getElementById('trackingPageView');
const statisticsPage = document.getElementById('statisticsPageView');
const toTrackingBtn = document.getElementById('toTrackingPageBtn');
const toStatsBtn = document.getElementById('toStatisticsPageBtn');

let cloudData = [];
let activeAthlete = "";
let activeDate = "";
let totalConfiguredShots = 10; 
let runningHits = 0;
let runningMisses = 0;

// Router UI Swaps
if (toTrackingBtn) {
    toTrackingBtn.addEventListener('click', () => {
        statisticsPage.style.display = 'none';
        trackingPage.style.display = 'block';
    });
}

if (toStatsBtn) {
    toStatsBtn.addEventListener('click', async () => {
        trackingPage.style.display = 'none';
        statisticsPage.style.display = 'block';
        await fetchCloudRecords();
    });
}

const volButtons = document.querySelectorAll('.vol-btn');
volButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        volButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        totalConfiguredShots = parseInt(btn.getAttribute('data-val'));
    });
});

async function init() {
    updateFilters();
    renderFilteredView();
    // Fetch data asynchronously in the background so it never freezes your buttons
    if (_supabase) {
        setTimeout(async () => {
            await fetchCloudRecords();
        }, 100);
    }
}

async function fetchCloudRecords() {
    if (!_supabase) return;
    try {
        const { data, error } = await _supabase
            .from('shooting_evals')
            .select('*')
            .order('date', { ascending: true });

        if (!error && data) {
            cloudData = data;
            updateFilters();
            renderFilteredView();
        }
    } catch (err) {
        console.error("Network connection failed:", err);
    }
}

if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        activeAthlete = document.getElementById('name').value;
        activeDate = document.getElementById('date').value;
        runningHits = 0;
        runningMisses = 0;

        document.getElementById('activeSessionHeader').innerText = `Active Counter: ${activeAthlete} (${activeDate})`;
        document.getElementById('liveTrackerPanel').style.display = "block";
        document.getElementById('hitBtn').disabled = false;
        document.getElementById('missBtn').disabled = false;
        document.getElementById('saveSessionBtn').style.display = "none";
        updateLiveTrackerUI();
    });
}

if (document.getElementById('hitBtn')) {
    document.getElementById('hitBtn').addEventListener('click', () => {
        if (getRemainingShots() > 0) { runningHits++; updateLiveTrackerUI(); }
    });
}

if (document.getElementById('missBtn')) {
    document.getElementById('missBtn').addEventListener('click', () => {
        if (getRemainingShots() > 0) { runningMisses++; updateLiveTrackerUI(); }
    });
}

if (document.getElementById('saveSessionBtn')) {
    document.getElementById('saveSessionBtn').addEventListener('click', async () => {
        const totalRecorded = runningHits + runningMisses;
        const accuracy = totalRecorded > 0 ? Math.round((runningHits / totalRecorded) * 100) : 0;

        if (!_supabase) {
            alert("Database connection is offline. Please check that you replaced your Supabase keys at the top of app.js!");
            return;
        }

        const { error } = await _supabase
            .from('shooting_evals')
            .insert([{
                athlete: activeAthlete,
                date: activeDate,
                total_shots: totalRecorded,
                successful: runningHits,
                failed: runningMisses,
                accuracy: accuracy
            }]);

        if (error) {
            alert("Cloud Save Error! Go to your Supabase Dashboard, look for Row-Level Security (RLS) on your table, and make sure it is turned OFF: " + error.message);
            return;
        }

        document.getElementById('liveTrackerPanel').style.display = "none";
        await fetchCloudRecords();
        
        document.getElementById('filterAthlete').value = activeAthlete;
        trackingPage.style.display = 'none';
        statisticsPage.style.display = 'block';
        renderFilteredView();
    });
}

function getRemainingShots() {
    return totalConfiguredShots - (runningHits + runningMisses);
}

function updateLiveTrackerUI() {
    const left = getRemainingShots();
    document.getElementById('shotCounterDisplay').innerText = `Shots Remaining: ${left} / ${totalConfiguredShots}`;
    document.getElementById('currentLiveStats').innerText = `Hits: ${runningHits} | Misses: ${runningMisses}`;
    
    if (left <= 0) {
        document.getElementById('hitBtn').disabled = true;
        document.getElementById('missBtn').disabled = true;
        document.getElementById('saveSessionBtn').style.display = "block";
        document.getElementById('shotCounterDisplay').innerHTML = `🎉 Session Complete! Ready to upload metrics.`;
    }
}

function updateFilters() {
    const athletes = [...new Set(cloudData.map(d => d.athlete))];
    const aSel = document.getElementById('filterAthlete');
    if (!aSel) return;
    const oldA = aSel.value;

    aSel.innerHTML = athletes.map(a => `<option value="${a}">${a}</option>`).join('');
    if (athletes.includes(oldA)) aSel.value = oldA;
}

if (document.getElementById('filterAthlete')) {
    document.getElementById('filterAthlete').addEventListener('change', renderFilteredView);
}

function renderFilteredView() {
    const aSel = document.getElementById('filterAthlete');
    if (!aSel) return;
    const currentAthlete = aSel.value;
    const filteredData = cloudData.filter(d => d.athlete === currentAthlete);
    renderTable(filteredData);
    drawNativeBarChart(filteredData, currentAthlete);
}

function renderTable(filteredData) {
    const body = document.getElementById('tableBody');
    if (!body) return;
    body.innerHTML = [...filteredData].reverse().map(d => {
        return `<tr><td>${d.date}</td><td>${d.athlete}</td><td>${d.total_shots}</td><td style="color:green; font-weight:bold;">${d.successful}</td><td style="color:red; font-weight:bold;">${d.failed}</td><td>${d.accuracy}%</td></tr>`;
    }).join('');
}

function drawNativeBarChart(filtered, currentA) {
    const canvas = document.getElementById('customChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('graphTitle').innerText = currentA ? `${currentA} - Cloud Metrics` : "Shooting Metrics";

    if (filtered.length === 0) {
        ctx.fillStyle = "#94a3b8"; ctx.font = "14px sans-serif";
        ctx.fillText("No cloud sessions recorded for this player yet.", 170, 130);
        document.getElementById('accuracyDisplay').innerText = "Accuracy: --%";
        return;
    }

    let totalSuccessful = 0, totalFailed = 0;
    filtered.forEach(d => { totalSuccessful += d.successful; totalFailed += d.failed; });
    const overallTotal = totalSuccessful + totalFailed;
    const accuracyPercent = overallTotal > 0 ? Math.round((totalSuccessful / overallTotal) * 100) : 0;
    document.getElementById('accuracyDisplay').innerText = `Total Cloud Accuracy: ${accuracyPercent}%`;

    const maxVal = Math.max(totalSuccessful, totalFailed, 5); const ceiling = Math.ceil(maxVal / 5) * 5;
    ctx.strokeStyle = "#f1f5f9"; ctx.lineWidth = 1; ctx.fillStyle = "#64748b"; ctx.font = "12px sans-serif";

    for (let i = 0; i <= 4; i++) {
        const val = Math.round((ceiling / 4) * i); const y = 200 - (i * 35);
        ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(550, y); ctx.stroke(); ctx.fillText(val, 30, y + 4);
    }

    const barWidth = 100, graphBaseY = 200, maxBarHeight = 140;
    const successHeight = ceiling > 0 ? (totalSuccessful / ceiling) * maxBarHeight : 0;
    const failedHeight = ceiling > 0 ? (totalFailed / ceiling) * maxBarHeight : 0;
    const successX = 170, failedX = 330;

    ctx.fillStyle = "#22c55e"; ctx.fillRect(successX, graphBaseY - successHeight, barWidth, successHeight);
    ctx.fillStyle = "#15803d"; ctx.font = "bold 14px sans-serif"; ctx.fillText(`${totalSuccessful}`, successX + 40, graphBaseY - successHeight - 8);

    ctx.fillStyle = "#ef4444"; ctx.fillRect(failedX, graphBaseY - failedHeight, barWidth, failedHeight);
    ctx.fillStyle = "#b91c1c"; ctx.font = "bold 14px sans-serif"; ctx.fillText(`${totalFailed}`, failedX + 40, graphBaseY - failedHeight - 8);

    ctx.fillStyle = "#334155"; ctx.font = "bold 13px sans-serif"; ctx.fillText("Hits", successX + 35, graphBaseY + 22); ctx.fillText("Misses", failedX + 25, graphBaseY + 22);
}

init();
