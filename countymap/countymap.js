//
//
// SETTINGS
//
//

/*
 * This is the max zoom level you can zoom into the map.
 * It should be noted that this does NOT mean that we require data to have this much detail. Data will be dynamically
 * loaded up to their maximum zoom values, and then we will lossily zoom in further until we reach this level.
 * 22 appears to be a nice value, anything more zoomed in doesn't really gain anything useful.
 */
let maxZoomSetting = 22;

//
//
// Load the CSV file that has info on our maps. Nothing can progress until we have this info.
//
//

let cityYearMap = {};
const control = document.getElementById("controlCheckbox");

// The most important thing for us to do is to know what maps are available, so that's the first thing we'll load.
// Everything else is dependent on this completing.
fetch('../assets/maps/map_context.csv')
  .then(res => res.text())
  .then(csv => {
    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        results.data.forEach((row) => {
          const city = row.Area.trim();
          const year = row.Year.trim();
          const fileLink = row['File/Link'].trim();
          // Explicit type casting is required here - I don't know why.
          // Somehow without this it specifically crashed only the Advanced mode - not Simple mode.
          const zoom = Number(row.MaxZoom.trim());

          // Prevent adding incomplete data.
          if (!city || !year || !fileLink || !zoom) {
              console.warn("Skipping invalid CSV row:", row);
              return;
          }

          // Initialize the city object if it doesn't exist yet
          if (!cityYearMap[city]) {
            cityYearMap[city] = {};
          }

          cityYearMap[city][year] = {};

          // Assign the file data.
          cityYearMap[city][year]["link"] = fileLink;
          cityYearMap[city][year]["zoom"] = zoom;
        });
      }
    });
    control.addEventListener("change", updateControls);
    loadSimple();
  })
  .catch(error => console.error('Error loading CSV:', error));


// Initialize the Leaflet map and center it on UMFlint (Go Blue!)
var map = L.map('map', {
  center: [43.01903661271984, -83.68866637835121],
  zoom: 15,
  maxZoom: maxZoomSetting
});

map.createPane('historicalMaps');
map.getPane('historicalMaps').style.zIndex = 350;

//
//
// In this section we manage the different aspects of controlling the maps.
//
//

var simple = true;

/*
 * Toggle which control method is currently used.
 * Flips between simple and advanced.
 */
function updateControls() {
    if (simple) {
        loadAdvanced();
        simple = false;
    } else {
        loadSimple();
        simple = true;
    }
}

//
//
// Handle everything for the advanced control method.
//
//

/*
 * Load the controls for the advanced control method from its respective HTML file.
 */
async function loadAdvanced() {
    fetch('controls-advanced.html')
      .then(response => {
        if (!response.ok) {
          throw new Error('Could not load advanced controls.');
        }
        return response.text();
      })
      .then(html => {
        document.getElementById('controls').innerHTML = html;
        // Nuke all map contents.
        map.eachLayer((layer) => {
          map.removeLayer(layer);
        });
        setupDraggable();
      })
      .catch(error => {
        console.error('Error loading the HTML file:', error);
      });
}

/*
 * To slightly clean things up, this is separated from the above method.
 * This method initializes and contains all code for operating the draggable system.
 * It is a bit daunting to get started with! Sorry
 */
function setupDraggable() {
  // First, find our elements that will hold content.
  const cityBucketsContainer = document.getElementById('cityBucketsContainer');
  const commonDisplayBucket = document.getElementById('commonDisplayBucket');

  const cityListRegistry = {};

  /*
   * This function updates the properties of boxes as they move between their home and active bucket.
   */
  function syncTileState(box) {
    // Find out if the box is currently in the active bucket.
    const isActive = box.parentElement === commonDisplayBucket;
    const handle = box.querySelector('.drag-handle');
    const opacityWrapper = box.querySelector('.opacity-control');
    const actionBtn = box.querySelector('.tile-action-btn');

    // If it is in the active bucket, it's going ot need an opacity bar and the ability to be removed.
    if (isActive) {
      handle.style.display = '';
      opacityWrapper.style.display = 'flex';
      actionBtn.textContent = '−';
      actionBtn.title = 'Remove from active';
    // If it isn't active, it doesn't need an opacity bar and needs the ability to be added.
    } else {
      handle.style.display = 'none';
      opacityWrapper.style.display = 'none';
      actionBtn.textContent = '+';
      actionBtn.title = 'Add to active';
    }
  }

  /*
   * This function returns a box back to the bucket that it originally came from.
   */
  function returnTileHome(box) {
    // Find what bucket this box belongs to.
    const homeList = cityListRegistry[box.dataset.city];
    if (!homeList) return;

    // Lists are sorted chronologically.
    // Find if there should be another map past this one.
    const targetYear = Number(box.dataset.year);
    const existingTiles = Array.from(homeList.querySelectorAll('.layer-item'));
    const nextTile = existingTiles.find(el => Number(el.dataset.year) > targetYear);

    // Either place the map before a certain map, or at the end.
    if (nextTile) homeList.insertBefore(box, nextTile);
    else homeList.appendChild(box);
  }

  new Sortable(commonDisplayBucket, {
    group: {
      name: 'shared-layers',
      pull: false,
      put: false
    },
    handle: '.drag-handle',
    animation: 150,
    onSort: updateDisplayData
  });

  /*
   * For complete transparency: this section here is largely AI generated. I could not for the life of me figure out how
   * to actually format/build the boxes, so I explained the problem, the libraries I am using, and prompted ChatGPT to
   * create this.
   *
   * I have fully read and analyzed this code, and all comments are left by me.
   */

  cityBucketsContainer.innerHTML = '';
  commonDisplayBucket.innerHTML = '';

  /*
   * Take data about a certain city and year, creating a box in the appropriate bucket.
   */
  function createLayerTile(options) {
    const { id, city, year = '', file = '', zoom = '', type = '', attribution = '', displayName } = options;

    // Create the base element for the entry. Attach some basic metadata.
    const box = document.createElement('div');
    box.className = 'layer-item d-flex align-items-center justify-content-between gap-3 px-3 py-2';
    box.dataset.id = id;
    box.dataset.city = city;
    box.dataset.year = year;
    box.dataset.file = file;
    box.dataset.zoom = zoom;
    box.dataset.type = type;
    box.dataset.attribution = attribution;
    box.dataset.opacity = '100';

    // On the left hand side of the box...
    const leftGroup = document.createElement('div');
    leftGroup.className = 'd-flex align-items-center gap-2 text-nowrap';

    // Add the handle which can be used to reorder boxes.
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';
    handle.style.cursor = 'grab';

    // Add the name of this specific box ("City (Year)")
    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = displayName;

    leftGroup.append(handle, name);

    // Now we'll start building the opacity controller...
    const opacityWrapper = document.createElement('div');
    opacityWrapper.className = 'opacity-control flex-column flex-grow-1 mx-2';
    opacityWrapper.style.maxWidth = '180px';

    // This is the text that is located above the bar.
    const opacityLabel = document.createElement('span');
    opacityLabel.textContent = 'Opacity';
    opacityLabel.className = 'text-muted';
    opacityLabel.style.fontSize = '0.7rem';
    opacityLabel.style.lineHeight = '1';
    opacityLabel.style.marginBottom = '4px';

    // This is the actual bar that is used. Range: [0, 100].
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'opacity-slider form-range m-0';
    slider.min = '0';
    slider.max = '100';
    slider.value = '100';
    slider.title = 'Layer opacity';
    slider.style.width = '100%';

    // When the slider is used, change opacity.
    slider.addEventListener('input', () => {
      box.dataset.opacity = slider.value;
      updateDisplayData(box.dataset.opacity, "opacity", box.dataset.id);
    });

    opacityWrapper.append(opacityLabel, slider);

    // Add the action button (+/-) for enabling/disabling the entry.
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'tile-action-btn btn btn-sm btn-outline-secondary flex-shrink-0';
    actionBtn.style.width = '32px';
    actionBtn.style.height = '32px';

    // If the button is clicked...
    actionBtn.addEventListener('click', () => {
      // And it is currently active, return home.
      if (box.parentElement === commonDisplayBucket) {
        returnTileHome(box);
        syncTileState(box);
        updateDisplayData(null, "remove", box.dataset.id);
      // And it is inactive, become active.
      } else {
        commonDisplayBucket.appendChild(box);
        syncTileState(box);
        updateDisplayData(box, "add", box.dataset.id);
      }
    });

    box.append(leftGroup, opacityWrapper, actionBtn);
    syncTileState(box);
    return box;
  }

  /*
   * This process handles creating buckets for cities.
   */
  function createBucketCard(bucketTitle, items) {
    // Create the element itself.
    const card = document.createElement('div');
    card.className = 'card shadow-sm mb-3';

    // Add a title onto the bucket.
    const header = document.createElement('div');
    header.className = 'card-header d-flex justify-content-between align-items-center py-2 px-3';
    header.style.cursor = 'pointer';
    header.style.userSelect = 'none';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'fw-semibold';
    titleSpan.textContent = bucketTitle;

    // Add an icon and transition for when the dropdown is toggled.
    const toggleIcon = document.createElement('span');
    toggleIcon.textContent = '▾';
    toggleIcon.style.transition = 'transform 0.2s ease';
    header.append(titleSpan, toggleIcon);

    // Start it collapsed.
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body p-2';
    cardBody.style.display = 'none';
    toggleIcon.style.transform = 'rotate(-90deg)';

    // When clicked, show contents.
    header.addEventListener('click', () => {
      const isHidden = cardBody.style.display === 'none';
      cardBody.style.display = isHidden ? '' : 'none';
      toggleIcon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
    });

    // Create the list where child boxes will live, and then register it in a global tracker.
    const listEl = document.createElement('div');
    listEl.className = 'city-list d-flex flex-column';
    cityListRegistry[bucketTitle] = listEl;

    // For each year inside the city, we'll create a child element.
    items.forEach((item) => {
      const tile = createLayerTile(item);
      listEl.appendChild(tile);
    });

    cardBody.appendChild(listEl);
    card.append(header, cardBody);
    cityBucketsContainer.appendChild(card);
  }

  // We create the general category first so it's displayed at the top.
  const generalItems = [
    { id: 'general_street_map', city: 'General', displayName: 'Street Map', type: "xyz", zoom: 19, file: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap Contributors' },
    { id: 'general_satellite_1998', city: 'General', displayName: 'Satellite (1998)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAPP_1998/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2005', city: 'General', displayName: 'Satellite (2005)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2005/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2006', city: 'General', displayName: 'Satellite (2006)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2006/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2009', city: 'General', displayName: 'Satellite (2009)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2009/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2010', city: 'General', displayName: 'Satellite (2010)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2010/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2012', city: 'General', displayName: 'Satellite (2012)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2012/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2014', city: 'General', displayName: 'Satellite (2014)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2014/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2016', city: 'General', displayName: 'Satellite (2016)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2016/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2018', city: 'General', displayName: 'Satellite (2018)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2018/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2020', city: 'General', displayName: 'Satellite (2020)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2020/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_2022', city: 'General', displayName: 'Satellite (2022)', type: "esri", file: 'https://imagery.michigan.gov/server/rest/services/Michigan_NAIP_2022/ImageServer', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' },
    { id: 'general_satellite_modern', city: 'General', displayName: 'Satellite (Modern)', type: "xyz", zoom: 19, file: 'https://imagery.michigan.gov/server/rest/services/Michigan_imagery_public/MapServer/tile/{z}/{y}/{x}', attribution: '© State of Michigan, Department of Technology, Management & Budget (DTMB), Center for Shared Solutions — MiSAIL aerial imagery.' }
  ];
  createBucketCard('General', generalItems);

  // Create everything else from our provided data.
  Object.entries(cityYearMap).forEach(([cityName, yearsObj]) => {
    const cityItems = Object.entries(yearsObj).map(([year, yearData]) => ({
      id: `${cityName.toLowerCase()}_${year}`,
      city: cityName,
      year: year,
      file: yearData?.link || '',
      zoom: yearData?.zoom || '',
      displayName: `${cityName} (${year})`,
      type: "pmtiles"
    }));

    createBucketCard(cityName, cityItems);
  });

  // Do we need this? Nothing has been added yet.
  //updateDisplayData();

  let advancedLayerCache = [];

  let paneCounter = 0;

  /*
   * Update the z-index of every active historical layer.
   * The first item in the draggable bucket is the topmost layer.
   */
  function refreshLayerOrder() {
    const count = advancedLayerCache.length;

    advancedLayerCache.forEach((entry, index) => {
      const pane = map.getPane(entry.paneName);

      if (!pane) return;

      const zIndex = Math.round(
        201 + ((count - index) / (count + 1)) * 198
      );

      pane.style.zIndex = zIndex;
    });
  }

  /*
   * This function is called when layers move around so that we can actually do stuff!
   * Here we adjust different map content settings.
   * This is actually much simpler than the "simple" control method because maps are verbosely added and removed,
   * meaning that we don't have to build a smart cache system to add and remove content!
   */
  function updateDisplayData(data, task, item) {

    console.log("running " + task)
    // Depending on which task is being performed...
    // Note: Task is always a string, but does not have to be present. Attached are its options:
    // add - We are adding a layer to the display.
    // remove - We are removing a layer from the display.
    // opacity - We are adjusting a layer's opacity.
    // *no content* - An entry has been moved.
    switch(task) {
      // If we're adding a map...
      case "add":
        const paneName = `historicalLayer${++paneCounter}`;
        map.createPane(paneName);

        /*
         * Really interesting bug that I thought I would document!
         * By default, esri layers are added to a separate pane than what tile layers and PMTiles are.
         * This esri pane is given a priority, meaning it cannot ever have other panes cover it if it is enabled.
         * Thus, we have to manually add everything to a single pane.
         */
        // Determine what type of map we're adding.
        switch (data.dataset.type) {
          case "esri":
            let esriLayer = L.esri.imageMapLayer({
              url: data.dataset.file,
              attribution: data.dataset.attribution,
              pane: paneName
            }).addTo(map);
            advancedLayerCache.push({
              id: item,
              layer: esriLayer,
              paneName: paneName
            });
            refreshLayerOrder();
            //esriLayer.bringToBack();
            break;
          case "pmtiles":
            const p = new pmtiles.PMTiles("../assets/maps/" + data.dataset.file);
            let addedLayer = pmtiles.leafletRasterLayer(p, {
              maxNativeZoom: Number(data.dataset.zoom),
              maxZoom: maxZoomSetting,
              pane: paneName
            }).addTo(map);
            advancedLayerCache.push({
              id: item,
              layer: addedLayer,
              paneName: paneName
            });
            refreshLayerOrder();
            //addedLayer.bringToBack();
            break;
          case "xyz":
            let streetMapLayer = L.tileLayer(
              data.dataset.file, {
              attribution: data.dataset.attribution,
              maxNativeZoom: Number(data.dataset.zoom),
              maxZoom: maxZoomSetting,
              pane: paneName
            }).addTo(map);
            advancedLayerCache.push({
              id: item,
              layer: streetMapLayer,
              paneName: paneName
            });
            refreshLayerOrder();
            //streetMapLayer.bringToBack();
            break;
        }
        break;
      // If we're removing a map...
      case "remove":
        // First, find where the file is located in the cache.
        const index = advancedLayerCache.findIndex(entry => entry.id === item);
        if (index === -1) return;
        // Replace it with nothing, removing it from the cache.
        const [removedEntry] = advancedLayerCache.splice(index, 1);
        // Remove it from the map.
        map.removeLayer(removedEntry.layer);
        // Finally, readjust all layers.
        refreshLayerOrder();
        break;
      // If we're adjusting a map's opacity...
      case "opacity":
        // Find the file in the cache.
        const found = advancedLayerCache.find(entry => entry.id === item);
        // Adjust the opacity.
        found.layer.setOpacity(data / 100.0);
        break;
      // Otherwise, the order of maps has been re-arranged.
      default:
        // Remove the item that was moved from its old spot in the cache.
        const [movingEntry] = advancedLayerCache.splice(data.oldIndex, 1);
        // Add the item that was moved to its new spot in the cache.
        advancedLayerCache.splice(data.newIndex, 0, movingEntry);
        // Adjust the layer orders.
        refreshLayerOrder();
        break;
    }
  }
}


//
//
// Handle everything for the simple control method.
//
//

var sliderSelectedYear;
var slider;
let simpleCache = {};
let simpleLayerCache = {};

/*
 * Load the controls for the simple control method from its respective HTML file.
 */
async function loadSimple() {
  simpleCache = {};
  simpleLayerCache = {};

  fetch('controls-simple.html')
    .then(response => {
      if (!response.ok) {
        throw new Error('Could not load simple controls.');
      }
      return response.text();
    })
    .then(html => {
      // Add the controls onto the page.
      document.getElementById('controls').innerHTML = html;

      // Find the element that displays the chosen year and the slider.
      sliderSelectedYear = document.getElementById("selectedYear");
      slider = document.getElementById("yearSelector");

      // Update the chosen year when the slider changes.
      slider.addEventListener("input", () => {
        sliderSelectedYear.innerHTML = slider.value;
        simpleMapUpdate();
      });
      sliderSelectedYear.innerHTML = slider.value;

      // Nuke all map contents and then add our base OpenStreetMap layer.
      map.eachLayer((layer) => {
        map.removeLayer(layer);
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: "© OpenStreetMap Contributors",
          maxNativeZoom: 19,
          maxZoom: maxZoomSetting
        }).addTo(map);

      // Finally, update the map.
      simpleMapUpdate();
    })
    .catch(error => {
      console.error('Error loading the HTML file:', error);
    });
}

/*
 * Handle determining what map should be shown via the current chosen year.
 * This system is scary! It has a somewhat sketchy caching system to prevent unnecessary loads, and it feels like it
 * kind of exploded into a mess.
 */
function simpleMapUpdate() {
  let removeLayers = [];

  // Reset the list of active maps every time the year updates.
  document.getElementById("activeMapsList").innerHTML = "";

  /*
   * Given a certain area, find what map file is closest to the current selected year.
   */
  function getClosestFile(areaRecords) {
    if (!areaRecords) return null;

    const years = Object.keys(areaRecords).map(Number);
    if (years.length === 0) return null;

    let closestYear = years[0];
    let minDiff = Math.abs(slider.value - closestYear);

    // Find whichever map is the closest to the current year.
    for (let i = 1; i < years.length; i++) {
      const diff = Math.abs(slider.value - years[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestYear = years[i];
      }
    }

    // Return nothing if 2025 is closer than the nearest record
    if (Math.abs(slider.value - 2025) < minDiff) {
      return null;
    }

    return areaRecords[closestYear];
  }

  // Check County first
  // Cities have more detail than county, so we'll place them on top.
  if (cityYearMap.County) {
    const countyData = getClosestFile(cityYearMap.County);
    const countyFile = countyData?.link;
    const countyZoom = Number(countyData?.zoom);

    // Add the chosen county year to the list of active maps.
    if (countyData && activeMapsList) {
      const countyYear = Object.keys(cityYearMap.County)
        .find(year => cityYearMap.County[year] === countyData);

      const li = document.createElement("li");
      li.textContent = `County (${countyYear})`;
      activeMapsList.appendChild(li);
    }

    if (countyFile) {
      // If the map has changed (prevent duplicate loadings, reduce bandwidth consumption)...
      if (!simpleCache["County"] || simpleCache["County"] !== countyFile) {
        // Load the new map onto a layer.
        const p = new pmtiles.PMTiles("../assets/maps/" + countyFile);
        let layer = pmtiles.leafletRasterLayer(p, {
          maxNativeZoom: Number(countyZoom),
          maxZoom: maxZoomSetting
        }).addTo(map);

        // If a previous county map was used, we need to remove it.
        if (simpleLayerCache["County"]) {
          removeLayers.push(simpleLayerCache["County"]);
        }

        // Track that we're now using this map.
        simpleCache["County"] = countyFile;
        simpleLayerCache["County"] = layer;
      }
    // This patched a bug that was making all layers disappear.
    // Entirely honest, I don't know why.
    } else if (simpleLayerCache["County"]) {
      simpleCache["County"] = "";
      removeLayers.push(simpleLayerCache["County"]);
    }
  }

  // Check all non-county entries
  for (const area of Object.keys(cityYearMap)) {
    if (area === 'County') continue;

    const cityData = getClosestFile(cityYearMap[area]);
    const cityFile = cityData?.link;
    const cityZoom = Number(cityData?.zoom);

    // Add the city map to the list of active maps.
    if (cityData && activeMapsList) {
      const cityYear = Object.keys(cityYearMap[area])
        .find(year => cityYearMap[area][year] === cityData);

      const li = document.createElement("li");
      li.textContent = `${area} (${cityYear})`;
      activeMapsList.appendChild(li);
    }

    // If there exists an appropriate city map...
    if (cityFile) {
      // If the map has changed (prevent duplicate loadings, reduce bandwidth consumption)...
      if (!simpleCache[area] || simpleCache[area] !== cityFile) {
        // Load the new map onto a layer.
        const p = new pmtiles.PMTiles("../assets/maps/" + cityFile);
        let layer = pmtiles.leafletRasterLayer(p, {
          maxNativeZoom: Number(cityZoom),
          maxZoom: maxZoomSetting
        }).addTo(map);

        // If a previous city map was used, we need to remove it.
        if (simpleLayerCache[area]) {
          removeLayers.push(simpleLayerCache[area]);
        }

        // Track that we're now using this map.
        simpleCache[area] = cityFile;
        simpleLayerCache[area] = layer;
      }
    // This patched a bug that was making all layers disappear.
    // Entirely honest, I don't know why.
    } else if (simpleLayerCache[area]) {
      simpleCache[area] = "";
      removeLayers.push(simpleLayerCache[area]);
    }
  }

  // Remove all layers that aren't being used anymore.
  removeLayers.forEach((layer) => {
    map.removeLayer(layer);
  });
}