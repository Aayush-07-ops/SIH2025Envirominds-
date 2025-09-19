// Global variables
let clientData = {};
let assessmentData = {};
let currentLocation = null;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize Application
function initializeApp() {
    setupEventListeners();
    checkGeolocationSupport();
}

// Event Listeners Setup
function setupEventListeners() {
    // Client form submission
    const clientForm = document.getElementById('clientForm');
    if (clientForm) {
        clientForm.addEventListener('submit', handleClientFormSubmission);
    }

    // Assessment form submission
    const assessmentForm = document.getElementById('assessmentForm');
    if (assessmentForm) {
        assessmentForm.addEventListener('submit', handleAssessmentFormSubmission);
    }

    // Location buttons
    const getLocationBtn = document.getElementById('getLocation');
    const pinLocationBtn = document.getElementById('pinLocation');
    
    if (getLocationBtn) {
        getLocationBtn.addEventListener('click', getCurrentLocation);
    }
    
    if (pinLocationBtn) {
        pinLocationBtn.addEventListener('click', pinCurrentLocation);
    }

    // Modal functionality
    const modal = document.getElementById('contactModal');
    const closeBtn = document.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (modal) {
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeModal();
            }
        });
    }

    // Language selector
    const languageSelect = document.getElementById('language');
    if (languageSelect) {
        languageSelect.addEventListener('change', changeLanguage);
    }
}

// Client Form Submission
async function handleClientFormSubmission(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    clientData = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        address: formData.get('address'),
        submissionTime: new Date().toISOString()
    };

    // Show loading state
    const submitBtn = event.target.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="loading"></span> Saving...';
    submitBtn.disabled = true;

    try {
        // Save to database
        await fetch('save_client.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        
        // Show success message
        showMessage('Client information saved successfully!', 'success');
        
        // Wait 2 seconds then redirect to assessment page
        setTimeout(() => {
            showAssessmentPage();
        }, 2000);
        
    } catch (error) {
        console.error('Error saving client data:', error);
        showMessage('Error saving client information. Please try again.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Assessment Form Submission
async function handleAssessmentFormSubmission(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    assessmentData = {
        roofArea: parseFloat(formData.get('roofArea')),
        openSpace: parseFloat(formData.get('openSpace')),
        location: formData.get('location'),
        soilType: formData.get('soilType'),
        gpsCoords: formData.get('gpsCoords'),
        assessmentTime: new Date().toISOString()
    };

    // Show loading state
    const calculateBtn = event.target.querySelector('.calculate-btn');
    calculateBtn.innerHTML = '<span class="loading"></span> Calculating...';
    calculateBtn.disabled = true;

    try {
        // Perform comprehensive assessment
        const results = await performWaterHarvestingAssessment(assessmentData);
        
        // Show results page
        displayResults(results);
        showResultsPage();
        
    } catch (error) {
        console.error('Error performing assessment:', error);
        showMessage('Error performing assessment. Please try again.', 'error');
        calculateBtn.textContent = 'Calculate Assessment';
        calculateBtn.disabled = false;
    }
}

// Geolocation Support Check
function checkGeolocationSupport() {
    if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser.');
        const locationBtns = document.querySelectorAll('.location-btn, .pin-btn');
        locationBtns.forEach(btn => {
            btn.disabled = true;
            btn.title = 'Geolocation not supported';
        });
    }
}

// Get Current Location
function getCurrentLocation() {
    const locationBtn = document.getElementById('getLocation');
    const locationInput = document.getElementById('location');
    
    if (!navigator.geolocation) {
        showMessage('Geolocation is not supported by your browser.', 'error');
        return;
    }

    // Show loading state
    locationBtn.innerHTML = '<span class="loading"></span>';
    locationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        async function(position) {
            currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };

            try {
                // Reverse geocoding to get address
                const address = await reverseGeocode(currentLocation.latitude, currentLocation.longitude);
                locationInput.value = address;
                
                // Update GPS coordinates field
                const gpsInput = document.getElementById('gpsCoords');
                if (gpsInput) {
                    gpsInput.value = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
                }

                showMessage('Location detected successfully!', 'success');
                
            } catch (error) {
                console.error('Error in reverse geocoding:', error);
                locationInput.value = `Lat: ${currentLocation.latitude.toFixed(6)}, Lng: ${currentLocation.longitude.toFixed(6)}`;
                showMessage('Location detected, but address lookup failed.', 'error');
            }

            // Reset button
            locationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
            locationBtn.disabled = false;
        },
        function(error) {
            console.error('Error getting location:', error);
            let errorMessage = 'Unable to get your location. ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Location access denied by user.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'Unknown error occurred.';
                    break;
            }
            
            showMessage(errorMessage, 'error');
            locationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
            locationBtn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000 // 5 minutes
        }
    );
}

// Pin Current Location
function pinCurrentLocation() {
    if (currentLocation) {
        const gpsInput = document.getElementById('gpsCoords');
        if (gpsInput) {
            gpsInput.value = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
            showMessage('Location pinned successfully!', 'success');
        }
    } else {
        showMessage('Please get your location first.', 'error');
    }
}

// Reverse Geocoding
async function reverseGeocode(lat, lng) {
    try {
        // Using OpenStreetMap Nominatim API (free)
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`);
        
        if (!response.ok) {
            throw new Error('Geocoding service unavailable');
        }
        
        const data = await response.json();
        return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        throw error;
    }
}

// Water Harvesting Assessment
async function performWaterHarvestingAssessment(data) {
    try {
        // Get coordinates for rainfall data
        let coordinates = currentLocation;
        if (!coordinates && data.gpsCoords) {
            const coords = data.gpsCoords.split(',');
            coordinates = {
                latitude: parseFloat(coords[0]),
                longitude: parseFloat(coords[1])
            };
        }

        // Fetch rainfall data
        const rainfallData = await getRainfallData(coordinates);
        
        // Calculate water storage potential
        const storageCalc = calculateWaterStorage(data, rainfallData);
        
        // Get soil recommendations
        const soilRecommendations = getSoilRecommendations(data.soilType, storageCalc);
        
        // Calculate cost estimation
        const costEstimation = calculateCostEstimation(data, storageCalc);
        
        // Get system recommendations
        const systemRecommendations = getSystemRecommendations(data, storageCalc);
        
        // Calculate groundwater impact
        const groundwaterImpact = calculateGroundwaterImpact(data, storageCalc);

        return {
            rainfallData,
            storageCapacity: storageCalc,
            soilRequirements: soilRecommendations,
            costEstimation,
            recommendedSystem: systemRecommendations,
            groundwaterImpact
        };
        
    } catch (error) {
        console.error('Assessment error:', error);
        throw error;
    }
}

// Get Rainfall Data
async function getRainfallData(coordinates) {
    try {
        // Simulate rainfall data (in a real app, you'd use a weather API)
        // Using mock data based on Indian monsoon patterns
        const mockRainfallData = {
            currentYear: 1250, // mm
            previousYear: 1180,
            averageRainfall: 1200,
            monthlyDistribution: {
                'Jan': 15, 'Feb': 20, 'Mar': 25, 'Apr': 45,
                'May': 85, 'Jun': 180, 'Jul': 220, 'Aug': 210,
                'Sep': 160, 'Oct': 95, 'Nov': 35, 'Dec': 20
            },
            rainyDays: 65,
            peakMonth: 'July',
            region: 'Central India' // This would be determined by coordinates
        };

        // In a real implementation, you would call:
        // const response = await fetch(https://api.weatherapi.com/v1/history.json?key=YOUR_API_KEY&q=${coordinates.latitude},${coordinates.longitude}&dt=2023-01-01&end_dt=2023-12-31);
        
        return mockRainfallData;
        
    } catch (error) {
        console.error('Error fetching rainfall data:', error);
        // Return default values for India
        return {
            currentYear: 1200,
            previousYear: 1150,
            averageRainfall: 1180,
            monthlyDistribution: {
                'Jun': 200, 'Jul': 250, 'Aug': 230, 'Sep': 150
            },
            rainyDays: 60,
            region: 'India'
        };
    }
}

// Calculate Water Storage Potential
function calculateWaterStorage(data, rainfallData) {
    const roofAreaM2 = data.roofArea;
    const openSpaceM2 = data.openSpace;
    const annualRainfallMm = rainfallData.currentYear;
    
    // Runoff coefficients based on surface type
    const roofRunoffCoeff = 0.85; // Concrete/tile roof
    const openSpaceRunoffCoeff = getRunoffCoefficient(data.soilType);
    
    // Calculate harvestable water (in liters)
    const roofWaterHarvest = roofAreaM2 * annualRainfallMm * roofRunoffCoeff;
    const openSpaceWaterHarvest = openSpaceM2 * annualRainfallMm * openSpaceRunoffCoeff;
    const totalHarvestableWater = roofWaterHarvest + openSpaceWaterHarvest;
    
    // Storage recommendations
    const recommendedStorageCapacity = Math.min(totalHarvestableWater * 0.6, 50000); // Max 50,000L
    const dailyConsumption = 150; // Liters per person per day (estimated)
    const householdSize = 4; // Estimated
    const daysCovered = recommendedStorageCapacity / (dailyConsumption * householdSize);
    
    return {
        roofHarvest: Math.round(roofWaterHarvest),
        openSpaceHarvest: Math.round(openSpaceWaterHarvest),
        totalHarvestable: Math.round(totalHarvestableWater),
        recommendedStorage: Math.round(recommendedStorageCapacity),
        daysCovered: Math.round(daysCovered),
        waterSavingPotential: Math.round(totalHarvestableWater * 0.7), // 70% actual saving
        roofRunoffCoeff,
        openSpaceRunoffCoeff
    };
}

// Get Runoff Coefficient
function getRunoffCoefficient(soilType) {
    const coefficients = {
        'clay': 0.65,
        'sandy': 0.35,
        'loamy': 0.45,
        'rocky': 0.75,
        'mixed': 0.50
    };
    
    return coefficients[soilType] || 0.45;
}

// Soil Recommendations
function getSoilRecommendations(soilType, storageCalc) {
    const recommendations = {
        'clay': {
            suitability: 'Good',
            infiltrationRate: 'Low (0.1-0.3 cm/hr)',
            recommendations: [
                'Excellent for surface storage systems',
                'Install percolation wells with sand/gravel filter',
                'Consider lined storage tanks',
                'Add organic matter to improve permeability'
            ],
            pitType: 'Lined storage pit with filtration system',
            depth: '3-4 meters',
            liningRequired: true
        },
        'sandy': {
            suitability: 'Fair',
            infiltrationRate: 'High (2.5-12.5 cm/hr)',
            recommendations: [
                'Focus on groundwater recharge',
                'Install recharge wells or bore wells',
                'Use rapid infiltration basins',
                'Minimal surface storage needed'
            ],
            pitType: 'Unlined recharge pit with gravel bed',
            depth: '4-6 meters',
            liningRequired: false
        },
        'loamy': {
            suitability: 'Excellent',
            infiltrationRate: 'Moderate (0.8-2.0 cm/hr)',
            recommendations: [
                'Ideal for both storage and recharge',
                'Balanced approach with storage tanks',
                'Install percolation pits',
                'Best overall soil type for RWH'
            ],
            pitType: 'Partially lined pit with overflow system',
            depth: '3-5 meters',
            liningRequired: false
        },
        'rocky': {
            suitability: 'Challenging',
            infiltrationRate: 'Very Low (0.05-0.2 cm/hr)',
            recommendations: [
                'Focus on surface collection and storage',
                'Use above-ground tanks',
                'Install check dams for surface runoff',
                'Consider blasting for pit construction'
            ],
            pitType: 'Above-ground storage with collection system',
            depth: '2-3 meters (if excavation possible)',
            liningRequired: true
        },
        'mixed': {
            suitability: 'Good',
            infiltrationRate: 'Variable (0.5-3.0 cm/hr)',
            recommendations: [
                'Conduct soil percolation test',
                'Hybrid system with storage and recharge',
                'Install multi-level filtration',
                'Adapt design based on dominant soil type'
            ],
            pitType: 'Flexible design based on soil composition',
            depth: '3-4 meters',
            liningRequired: false
        }
    };

    const soilRec = recommendations[soilType] || recommendations['mixed'];
    
    // Calculate required pit dimensions
    const storageVolume = storageCalc.recommendedStorage; // in liters
    const pitVolume = storageVolume * 1.2; // 20% extra for sediment
    const pitDiameter = Math.sqrt(pitVolume / (Math.PI * parseInt(soilRec.depth) * 1000)) * 2; // meters

    return {
        ...soilRec,
        requiredPitDiameter: Math.round(pitDiameter * 10) / 10,
        requiredPitVolume: Math.round(pitVolume),
        excavationVolume: Math.round(pitVolume * 1.5), // Including approach and safety
        soilType: soilType
    };
}

// Cost Estimation
function calculateCostEstimation(data, storageCalc) {
    const storageCapacity = storageCalc.recommendedStorage; // in liters
    const roofArea = data.roofArea;
    const soilType = data.soilType;
    
    // Base costs (in INR)
    const costs = {
        excavation: (storageCapacity / 1000) * 500, // ₹500 per cubic meter
        lining: soilType === 'clay' || soilType === 'rocky' ? (storageCapacity / 1000) * 800 : 0,
        filtration: 15000, // Basic filtration system
        piping: roofArea * 150, // ₹150 per sq m for gutters and pipes
        pumping: storageCapacity > 10000 ? 25000 : 0, // Pump if large system
        firstFlush: 5000, // First flush diverter
        storage: storageCapacity * 8, // ₹8 per liter storage cost
        labor: (storageCapacity / 1000) * 2000, // ₹2000 per cubic meter
        miscellaneous: 10000 // Fittings, valves, etc.
    };

    const totalCost = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
    
    // Maintenance costs (annual)
    const maintenanceCost = {
        cleaning: 3000,
        filterReplacement: 2000,
        pumpMaintenance: costs.pumping > 0 ? 1500 : 0,
        inspection: 1000
    };

    const annualMaintenance = Object.values(maintenanceCost).reduce((sum, cost) => sum + cost, 0);

    // ROI Calculation
    const waterSavedPerYear = storageCalc.waterSavingPotential; // liters
    const waterCostPerLiter = 0.05; // ₹0.05 per liter (municipal water cost)
    const annualSavings = waterSavedPerYear * waterCostPerLiter;
    const paybackPeriod = totalCost / (annualSavings - annualMaintenance);

    return {
        breakdown: costs,
        totalInstallation: Math.round(totalCost),
        annualMaintenance: Math.round(annualMaintenance),
        annualSavings: Math.round(annualSavings),
        paybackPeriod: Math.round(paybackPeriod * 10) / 10,
        costPerLiterCapacity: Math.round((totalCost / storageCapacity) * 100) / 100,
        governmentSubsidy: Math.round(totalCost * 0.3), // 30% subsidy available
        netCost: Math.round(totalCost * 0.7)
    };
}

// System Recommendations
function getSystemRecommendations(data, storageCalc) {
    const totalWater = storageCalc.totalHarvestable;
    const roofArea = data.roofArea;
    const soilType = data.soilType;
    
    let systemType, components, benefits;
    
    if (totalWater < 50000) {
        systemType = "Basic Rooftop Harvesting";
        components = [
            "Roof gutters and downpipes",
            "First flush diverter",
            "Storage tank (5,000-10,000L)",
            "Basic filtration unit",
            "Overflow management"
        ];
    } else if (totalWater < 150000) {
        systemType = "Intermediate RWH System";
        components = [
            "Complete catchment system",
            "Multi-stage filtration",
            "Underground storage tank (15,000-25,000L)",
            "Pump and distribution system",
            "Groundwater recharge pit"
        ];
    } else {
        systemType = "Advanced RWH System";
        components = [
            "Comprehensive collection network",
            "Automated first flush system",
            "Multiple storage units (50,000L+)",
            "Water treatment plant",
            "Smart monitoring system",
            "Groundwater recharge wells"
        ];
    }
    
    benefits = [
        `Save ${Math.round(storageCalc.waterSavingPotential / 1000)} kiloliters annually`,
        `Reduce water bill by ₹${Math.round(storageCalc.waterSavingPotential * 0.05)} per year`,
        `Groundwater recharge of ${Math.round(totalWater * 0.3 / 1000)} kiloliters`,
        `Flood reduction in local area`,
        `Emergency water supply for ${Math.round(storageCalc.daysCovered)} days`
    ];

    return {
        systemType,
        components,
        benefits,
        efficiency: calculateSystemEfficiency(data, storageCalc),
        maintenanceSchedule: getMaintenanceSchedule(),
        expectedLifespan: "15-25 years with proper maintenance"
    };
}

// Calculate System Efficiency
function calculateSystemEfficiency(data, storageCalc) {
    const collectionEfficiency = (storageCalc.roofRunoffCoeff + storageCalc.openSpaceRunoffCoeff) / 2;
    const storageEfficiency = Math.min(storageCalc.recommendedStorage / storageCalc.totalHarvestable, 0.8);
    const overallEfficiency = collectionEfficiency * storageEfficiency * 0.85; // 85% system efficiency
    
    return Math.round(overallEfficiency * 100);
}

// Get Maintenance Schedule
function getMaintenanceSchedule() {
    return {
        'Weekly': ['Check for blockages in gutters', 'Inspect first flush diverter'],
        'Monthly': ['Clean roof and gutters', 'Check water quality', 'Test pump operation'],
        'Quarterly': ['Replace filters', 'Check storage tank condition', 'Inspect piping'],
        'Annually': ['Professional system inspection', 'Deep cleaning', 'Repair and replacement']
    };
}

// Calculate Groundwater Impact
function calculateGroundwaterImpact(data, storageCalc) {
    const rechargeVolume = storageCalc.totalHarvestable * 0.4; // 40% goes to groundwater
    const rechargeArea = data.roofArea + data.openSpace; // sq m
    const aquiferType = getAquiferType(data.soilType);
    
    // Groundwater level rise calculation (simplified)
    const specificYield = getSpecificYield(data.soilType);
    const levelRise = (rechargeVolume / 1000) / (rechargeArea * specificYield); // in meters
    
    return {
        annualRecharge: Math.round(rechargeVolume),
        estimatedLevelRise: Math.round(levelRise * 100) / 100, // in meters
        aquiferType: aquiferType,
        specificYield: specificYield,
        rechargeRate: Math.round((rechargeVolume / storageCalc.totalHarvestable) * 100),
        environmentalBenefits: [
            'Reduces urban flooding',
            'Improves local groundwater levels',
            'Reduces soil erosion',
            'Supports local vegetation',
            'Maintains natural water cycle'
        ],
        impactRadius: Math.round(Math.sqrt(rechargeArea / Math.PI) * 2), // meters
        qualityImprovement: getWaterQualityImpact(data.soilType)
    };
}

// Get Aquifer Type
function getAquiferType(soilType) {
    const types = {
        'clay': 'Confined aquifer',
        'sandy': 'Unconfined aquifer',
        'loamy': 'Semi-confined aquifer',
        'rocky': 'Fractured rock aquifer',
        'mixed': 'Complex aquifer system'
    };
    
    return types[soilType] || 'Mixed aquifer system';
}

// Get Specific Yield
function getSpecificYield(soilType) {
    const yields = {
        'clay': 0.03,
        'sandy': 0.25,
        'loamy': 0.15,
        'rocky': 0.05,
        'mixed': 0.12
    };
    
    return yields[soilType] || 0.12;
}

// Get Water Quality Impact
function getWaterQualityImpact(soilType) {
    const impacts = {
        'clay': 'Natural filtration, slower recharge',
        'sandy': 'Rapid infiltration, minimal filtration',
        'loamy': 'Good balance of infiltration and filtration',
        'rocky': 'Variable quality depending on rock type',
        'mixed': 'Varied quality improvement'
    };
    
    return impacts[soilType] || 'Moderate quality improvement';
}

// Display Results
function displayResults(results) {
    // Update client summary
    const clientSummary = document.getElementById('clientSummary');
    if (clientSummary) {
        clientSummary.innerHTML = `
            <p><strong>Name:</strong> ${clientData.name}</p>
            <p><strong>Location:</strong> ${assessmentData.location}</p>
            <p><strong>Assessment Date:</strong> ${new Date().toLocaleDateString()}</p>
        `;
    }

    // Update rainfall data
    const rainfallDataDiv = document.getElementById('rainfallData');
    if (rainfallDataDiv) {
        rainfallDataDiv.innerHTML = `
            <p><strong>Current Year:</strong> ${results.rainfallData.currentYear} mm</p>
            <p><strong>Previous Year:</strong> ${results.rainfallData.previousYear} mm</p>
            <p><strong>Average:</strong> ${results.rainfallData.averageRainfall} mm</p>
            <p><strong>Rainy Days:</strong> ${results.rainfallData.rainyDays} days</p>
            <p><strong>Region:</strong> ${results.rainfallData.region}</p>
        `;
    }

    // Update storage capacity
    const storageCapacityDiv = document.getElementById('storageCapacity');
    if (storageCapacityDiv) {
        storageCapacityDiv.innerHTML = `
            <p><strong>Total Harvestable:</strong> ${results.storageCapacity.totalHarvestable.toLocaleString()} L</p>
            <p><strong>Recommended Storage:</strong> ${results.storageCapacity.recommendedStorage.toLocaleString()} L</p>
            <p><strong>Days Covered:</strong> ${results.storageCapacity.daysCovered} days</p>
            <p><strong>Annual Savings:</strong> ${results.storageCapacity.waterSavingPotential.toLocaleString()} L</p>
        `;
    }

    // Update recommended system
    const recommendedSystemDiv = document.getElementById('recommendedSystem');
    if (recommendedSystemDiv) {
        recommendedSystemDiv.innerHTML = `
            <p><strong>System Type:</strong> ${results.recommendedSystem.systemType}</p>
            <p><strong>Efficiency:</strong> ${results.recommendedSystem.efficiency}%</p>
            <p><strong>Lifespan:</strong> ${results.recommendedSystem.expectedLifespan}</p>
            <p><strong>Components:</strong> ${results.recommendedSystem.components.length} items</p>
        `;
    }

    // Update cost estimation
    const costEstimationDiv = document.getElementById('costEstimation');
    if (costEstimationDiv) {
        costEstimationDiv.innerHTML = `
            <p><strong>Installation Cost:</strong> ₹${results.costEstimation.totalInstallation.toLocaleString()}</p>
            <p><strong>With Subsidy:</strong> ₹${results.costEstimation.netCost.toLocaleString()}</p>
            <p><strong>Annual Savings:</strong> ₹${results.costEstimation.annualSavings.toLocaleString()}</p>
            <p><strong>Payback Period:</strong> ${results.costEstimation.paybackPeriod} years</p>
        `;
    }

    // Update soil requirements
    const soilRequirementsDiv = document.getElementById('soilRequirements');
    if (soilRequirementsDiv) {
        soilRequirementsDiv.innerHTML = `
            <p><strong>Suitability:</strong> ${results.soilRequirements.suitability}</p>
            <p><strong>Pit Type:</strong> ${results.soilRequirements.pitType}</p>
            <p><strong>Required Depth:</strong> ${results.soilRequirements.depth}</p>
            <p><strong>Diameter:</strong> ${results.soilRequirements.requiredPitDiameter} m</p>
        `;
    }

    // Update groundwater impact
    const groundwaterImpactDiv = document.getElementById('groundwaterImpact');
    if (groundwaterImpactDiv) {
        groundwaterImpactDiv.innerHTML = `
            <p><strong>Annual Recharge:</strong> ${results.groundwaterImpact.annualRecharge.toLocaleString()} L</p>
            <p><strong>Level Rise:</strong> ${results.groundwaterImpact.estimatedLevelRise} m</p>
            <p><strong>Aquifer Type:</strong> ${results.groundwaterImpact.aquiferType}</p>
            <p><strong>Impact Radius:</strong> ${results.groundwaterImpact.impactRadius} m</p>
        `;
    }
}

// Page Navigation Functions
function showAssessmentPage() {
    document.getElementById('clientInfoPage').classList.remove('active');
    document.getElementById('assessmentPage').classList.add('active');
}

function showResultsPage() {
    document.getElementById('assessmentPage').classList.remove('active');
    document.getElementById('resultsPage').classList.add('active');
}

function startNewAssessment() {
    // Reset data
    clientData = {};
    assessmentData = {};
    currentLocation = null;
    
    // Reset forms
    document.getElementById('clientForm').reset();
    document.getElementById('assessmentForm').reset();
    
    // Show first page
    document.getElementById('resultsPage').classList.remove('active');
    document.getElementById('clientInfoPage').classList.add('active');
}

// Generate Report
function generateReport() {
    // Create a comprehensive report
    const reportContent = `
        <div class="report-header">
            <h1>Rain Water Harvesting Assessment Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="report-section">
            <h2>Client Information</h2>
            <p>Name: ${clientData.name}</p>
            <p>Location: ${assessmentData.location}</p>
            <p>Contact: ${clientData.phone}</p>
        </div>
        
        <!-- Add more report sections here -->
    `;
    
    // Open in new window for printing
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>RWH Assessment Report</title>
            <link rel="stylesheet" href="style.css">
        </head>
        <body>
            ${reportContent}
        </body>
        </html>
    `);
    reportWindow.document.close();
    reportWindow.print();
}

// Modal Functions
function showContactInfo() {
    document.getElementById('contactModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('contactModal').style.display = 'none';
}

// Language Change
function changeLanguage(event) {
    const language = event.target.value;
    // In a real application, you would implement i18n here
    console.log('Language changed to:', language);
    showMessage(`Language changed to ${language}`, 'success');
}

// Utility Functions
function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;
    
    // Find the active page and append message
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        const container = activePage.querySelector('.container');
        if (container) {
            container.insertBefore(messageDiv, container.firstChild);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        }
    }
}

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateWaterStorage,
        getSoilRecommendations,
        calculateCostEstimation,
        getSystemRecommendations,
        calculateGroundwaterImpact
    };
}
