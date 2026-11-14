// Retrieve tiles from OpenStreetMap API + add Attribution per licensing requirements.
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: "© OpenStreetMap Contributors"
}).addTo(map);
    // Initialize the PMTiles instance with your archive URL
    const p = new pmtiles.PMTiles("./flint_1909_22.pmtiles");

    // Create the Leaflet raster layer and add it to the map
    pmtiles.leafletRasterLayer(p, {
      attribution: '&copy; Your Attribution'
    }).addTo(map);
// Create a layer for our markers to be placed on.
var allMarkers = L.layerGroup().addTo(map);

/*
 * Find each HTML element we want to control..
 */

const active = document.getElementById("activeCheckbox");
const closed = document.getElementById("closedCheckbox");
const moved = document.getElementById("movedCheckbox");
const proposed = document.getElementById("activelyProposedCheckbox");
const exProposed = document.getElementById("previouslyProposedCheckbox");
const avLocation = document.getElementById("averageLocationCheckbox");

/*
 * Handle updating map on data changes.
 */

function updateMap() {
    if (data == null) return;

    // Fixes misc issues with tile loading.
    map.invalidateSize();

    // Retrieve data from our HTML elements.
    const year = Number(slider.value);
    const showActive = active.checked;
    const showClosed = closed.checked;
    const showMoved = moved.checked;
    const showProposed = proposed.checked;
    const showExProposed = exProposed.checked;
    const showAvgLocation = avLocation.checked;

    // Remove all current markers from the map.
    allMarkers.clearLayers();

    let totalLat = 0, totalLong = 0, activeCount = 0;

    data.forEach(d => {
        if (year >= d.YearStart && year < d.YearEnd) {
            if (showAvgLocation && d.Status === "active") {
                totalLat += Number(d.Latitude);
                totalLong += Number(d.Longitude);
                activeCount++;
            }

            if (
                (d.Status === "active" && showActive) ||
                (d.Status === "closed" && showClosed) ||
                (d.Status === "moved" && showMoved) ||
                (d.Status === "activeProposal" && showProposed) ||
                (d.Status === "previousProposal" && showExProposed)
            ) {
                // Create a basic description using the current name and final name.
                var description = d.Name + "<br>See " + (d.CustomSeeName != "" ? d.CustomSeeName : d.FinalName);

                //
                if (d.PriorUse != "") {
                    description = description + "<br>For prior uses of this site, please see " + d.PriorUse;
                }

                if (d.Comment != "") {
                    description = description + "<br>" + d.Comment;
                }

                // Build the marker that will be added to the map.
                const marker = L.marker(
                    [d.Latitude, d.Longitude],
                    { icon: statusIcons[d.Status] }
                ).bindPopup(description);

                // And finally add the marker!
                allMarkers.addLayer(marker);
            }
        }
    });

    if (showAvgLocation && activeCount > 0) {
        let avgLat = totalLat / activeCount, avgLong = totalLong / activeCount;
        // Build the marker that will be added to the map.
        const marker = L.marker(
            [avgLat, avgLong],
            { icon: averageIcon }
        ).bindPopup("Average location of active facilities.");

        // And finally add the marker!
        allMarkers.addLayer(marker);
    }
}


/*
 * Trigger a map market update whenever a checkbox / slider is updated.
 */
active.addEventListener("change", updateMap);
closed.addEventListener("change", updateMap);
moved.addEventListener("change", updateMap);
proposed.addEventListener("change", updateMap);
exProposed.addEventListener("change", updateMap);
avLocation.addEventListener("change", updateMap);