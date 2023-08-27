function weatherWidgetInit() {
    const config = {
        CSS_URL: 'https://rawcdn.githack.com/george14051/weatherWidgetScript/63808ee09fcf40f0a660b3fc0f3387b64d1db927/docs/styles.css',
        API_WEATHER_HISTORY_URL: 'https://api.open-meteo.com/v1/forecast',
        API_WEATHER_HISTORY_DAILY_PARAMETERS: '&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=GMT&past_days=31',
        API_AUTOCOMPLETE_URL: 'https://geocoding-api.open-meteo.com/v1/search'
    }

    const initialautocompleteContainerHtml = `
    <div id="autocomplete-top-container">
        <button id="clear-button" class="btnWeather">clear</button>
        <input type="text" id="autocomplete-input" placeholder="search by city or coordinates lon,lat (e.g. '43.03333 , 17.64306')">
        <button id="search-button" class="btnWeather">search</button>
    </div>
    <div id="error-message" style="display: none; color: red;"></div>
    <div id="helper-text" style="display: none; color: blue; padding-left: 6px;"></div>
    <ul id="autocomplete-results" style="display: none;"></ul>
    <div id="search-results"></div>
`

    const weatherWidgetState = {
        targetInjectionDiv: document.currentScript.getAttribute('targetDiv'),
        selectedSuggestionIndex: -1,
        autocompleteResultsData: []
    };

    function getElementById(elementId) {
        return document.getElementById(elementId);
    }


    async function fetchData(url) {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Request fetchData failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            indicateErrorMessage(false, 'Invalid input');
            console.error('fetchData error:', error);
        }
    }
    async function fetchHistoryWeather(latitude, longitude) {
        const { API_WEATHER_HISTORY_URL, API_WEATHER_HISTORY_DAILY_PARAMETERS } = config;
        try {
            const url = `${API_WEATHER_HISTORY_URL}?latitude=${latitude}&longitude=${longitude}${API_WEATHER_HISTORY_DAILY_PARAMETERS}`;
            const historyData = await fetchData(url);

            return historyData;
        } catch (error) {
            console.error('fetchHistoryWeather error:', error);
        }
    }

    async function debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);

            return new Promise((resolve) => {
                timeoutId = setTimeout(async () => {
                    const result = await func(...args);
                    resolve(result);
                }, delay);
            });
        }
    }

    async function performAutocomplete(query) {
        const { API_AUTOCOMPLETE_URL } = config;
        const data = await fetchData(`${API_AUTOCOMPLETE_URL}?name=${query}&count=10`);
        return data;
    }

    async function debouncedPerformAutocomplete(query) {
        return (await debounce(performAutocomplete, 300))(query);
    }

    function selectSuggestion(index, suggestions) {
        // Find the previously selected suggestion and remove its "selected" class
        const previouslySelected = suggestions.find(suggestion => suggestion.classList.contains("selected"));
        if (previouslySelected) {
            previouslySelected.classList.remove("selected");
        }

        // Find the newly selected suggestion and add its "selected" class
        const selectedSuggestion = suggestions[index];
        if (selectedSuggestion) {
            selectedSuggestion.classList.add("selected");
        }
    }

    function createElement(tagName, id, innerHtml = ``) {
        const element = document.createElement(tagName);
        element.id = id;
        element.innerHTML = `${innerHtml}`;
        return element;
    }

    async function createWeatherCards(latitude, longitude, searchValue) {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        try {
            const historyWeather = await fetchHistoryWeather(latitude, longitude);
            displayAutocompleteResults(false);
            weatherWidgetState.autocompleteInput.value = searchValue;

            const avaragedTempratures = calculateAvarageWeather(historyWeather?.daily);
            weatherWidgetState.searchResults.innerHTML = '';
            avaragedTempratures.forEach((avgTemp, dayIndex) => {
                const card = document.createElement('div');
                card.classList.add('weather-card');
                card.innerHTML = `
                <div class="temperature">${avgTemp.maxTemperatureAvg}&deg;C</div>
                <div class="sub-temperature">${avgTemp.minTemperatureAvg}&deg;C</div>
                <div class="day">${days[dayIndex]}</div>
            `;
                weatherWidgetState.searchResults.appendChild(card);
            });
        } catch (error) {
            console.error('createWeatherCards error:', error);
        }
    }

    function calculateAvarageWeather(historyWeather) {
        let dayTemperatures = Array.from({ length: 7 }, () => ({ maxTemperatureAvg: 0, minTemperatureAvg: 0, count: 0, weathercode: 0 }));
        // got from the api also forcast of 7 days so removed them.
        historyWeather.time.splice(31);
        historyWeather.time.forEach((date, index) => {
            const dayIndex = new Date(date).getDay();
            dayTemperatures[dayIndex].maxTemperatureAvg += historyWeather.temperature_2m_max[index];
            dayTemperatures[dayIndex].minTemperatureAvg += historyWeather.temperature_2m_min[index];
            dayTemperatures[dayIndex].count++;
            dayTemperatures[dayIndex].weathercode = historyWeather.weathercode[index];
        })

        const averageTemperatures = dayTemperatures.map(({ maxTemperatureAvg, minTemperatureAvg, count }) => ({
            maxTemperatureAvg: Math.floor(maxTemperatureAvg / count),
            minTemperatureAvg: Math.floor(minTemperatureAvg / count)
        }));

        return averageTemperatures
    }

    function checkIfCoordinates(value) {
        const regexExpCoordinates = /^((\-?|\+?)?\d+(\.\d+)?),\s*((\-?|\+?)?\d+(\.\d+)?)$/gi;
        const trimmedValue = value.split(" ").join("");
        return regexExpCoordinates.test(trimmedValue)
    }



    //check if the target website have fixed header and add top to the injected element
    function addTopIfOtherHeaders(element) {

        const headersTags = document.getElementsByTagName("header");
        const headerTagsArray = Object.values(headersTags);
        let headerStickyHeight = 0;
        let resPosition;
        headerTagsArray.forEach((header) => {
            const computedStyleHeader = window.getComputedStyle(header, null);
            const positionHeader = computedStyleHeader.getPropertyValue('position');
            if (positionHeader === 'fixed' || positionHeader === 'sticky') {
                resPosition = positionHeader;
                const heightHeader = parseInt(computedStyleHeader.getPropertyValue('height'));
                headerStickyHeight = Math.max(headerStickyHeight, heightHeader);
            }
        })
        element.style.top = `${headerStickyHeight}px`;
        return resPosition
    }

    function indicateErrorMessage(isValid, message = "No results found.") {
        const { errorMessage } = weatherWidgetState
        if (!isValid) {
            errorMessage.style.display = 'block';
            errorMessage.textContent = message;
        } else {
            errorMessage.style.display = 'none';
        }
    }

    async function handleSearchSubmit(inputValue, suggestedIndex) {
        try {
            const { autocompleteResultsData, inputType, autocompleteInput } = weatherWidgetState;
            const inputLen = autocompleteInput.value.trim().length;
            switch (inputType) {
                case 'string': {
                    if (autocompleteResultsData?.length > 0) {
                        const selectedOption = autocompleteResultsData[suggestedIndex];
                        await createWeatherCards(selectedOption.latitude, selectedOption.longitude, selectedOption.name);
                    } else {
                        indicateErrorMessage(false);
                    }
                    break;
                }
                case 'coordinates': {
                    setHelperText(false);
                    const [latitude, longitude] = inputValue.split(',').map(coordinate => coordinate.trim());
                    await createWeatherCards(latitude, longitude, inputValue);
                    break;
                }
                default: {
                    setHelperText(false)
                    indicateErrorMessage(false, inputLen < 2 ? "At least 2 characters required" : 'invalid input');
                }

            }
        } catch (error) {
            indicateErrorMessage(false, "Invalid Input")
            console.error('handleSearchSubmit error:', error);
        }

    }

    function displayAutocompleteResults(display) {
        const { autocompleteResults } = weatherWidgetState;
        if (display) {
            autocompleteResults.innerHTML = '';
            autocompleteResults.style.display = 'block';
            autocompleteResults.style.padding = '6px';
        } else {
            autocompleteResults.innerHTML = '';
            autocompleteResults.style.display = 'none';
        }

    }

    function addItemsToAutocompleteResults(results) {
        results?.forEach(result => {
            const resultItem = document.createElement("li");
            resultItem.textContent = `${result.name}, ${result.country}`;
            resultItem.className = 'listItem';

            resultItem.addEventListener("click", async function (e) {
                e.preventDefault();
                await createWeatherCards(result.latitude, result.longitude, result.name);
            });

            weatherWidgetState.autocompleteResults.appendChild(resultItem);
        });
    }

    function addDragAndDrop(element) {

        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        element.style.cursor = 'grab'

        // Event listeners for mouse events
        element.addEventListener('mousedown', (event) => {
            if (event.target.id !== "autocomplete-input" &&
                event.target.id !== "search-button" &&
                event.target.id !== "clear-button") {
                isDragging = true;
                offsetX = event.clientX - element.getBoundingClientRect().left;
                offsetY = event.clientY - element.getBoundingClientRect().top;
            }
        });

        document.addEventListener('mousemove', (event) => {
            if (isDragging) {
                const newX = event.clientX - offsetX;
                const newY = event.clientY - offsetY;
                element.style.left = `${newX}px`;
                element.style.top = `${newY}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        element.addEventListener('dragstart', (event) => {
            if (isDragging) {
                event.preventDefault();
            }
        });
    }
    function createLinkTag(rel, type, href) {
        const link = document.createElement('link');
        link.rel = rel;
        link.type = type;
        link.href = href;
        return link;
    }

    // elementsObjects array of [{stateKey : elementId}]
    function addElementsToState(elementsObjects) {
        for (const [key, value] of Object.entries(elementsObjects)) {
            weatherWidgetState[key] = getElementById(value);
        }
    }

    function handleChangeAutocompleteResults(results) {
        weatherWidgetState.autocompleteResultsData = results;

        if (!results?.length) {
            indicateErrorMessage(false);
            displayAutocompleteResults(false);
        } else {
            indicateErrorMessage(true);
            displayAutocompleteResults(true);
            addItemsToAutocompleteResults(results)
        }
    }



    function setInputTypeState(inputLen, isCoordiantion, value, prevInput) {
        let type;
        if (inputLen) {
            if (isCoordiantion) {
                type = 'coordinates';
            } else if (isNaN(value)) {
                type = 'string';
            } else {
                type = 'number';
            }
        } else {
            type = undefined
        }
        weatherWidgetState.inputType = type;
        return type;
    }

    function setHelperText(show, color = 'blue', message = 'Example - 43.03333 , 17.64306') {
        const { helperText } = weatherWidgetState;

        if (show) {
            helperText.style.display = 'block';
            helperText.textContent = message;
            helperText.style.color = color;
        } else {
            helperText.style.display = 'none';
        }
    }

    async function inputChangeHandler() {
        const { autocompleteInput } = weatherWidgetState;
        const inputValue = autocompleteInput.value.trim().toLowerCase();

        indicateErrorMessage(true);

        const inputLen = inputValue.length
        //set inputType
        const currInputType = setInputTypeState(inputLen, checkIfCoordinates(inputValue), inputValue)


        switch (currInputType) {
            case 'string': {
                setHelperText(false);
                const optionsList = await debouncedPerformAutocomplete(inputValue);
                handleChangeAutocompleteResults(optionsList.results || []);
                break;
            }
            case 'coordinates': {
                indicateErrorMessage(false);
                setHelperText(true);
                break;
            }
            case 'number': {
                setHelperText(true);
                break;
            }
            default: {
                indicateErrorMessage(true)
                displayAutocompleteResults(false);
            }

        }
        weatherWidgetState.selectedSuggestionIndex = -1;

    }

    async function onInputKeyDownHandler(event) {
        const suggestions = [...weatherWidgetState.autocompleteResults.children];
        const { autocompleteInput } = weatherWidgetState;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (suggestions.length > 0) {
                weatherWidgetState.selectedSuggestionIndex = weatherWidgetState.selectedSuggestionIndex + 1;
                selectSuggestion(weatherWidgetState.selectedSuggestionIndex % suggestions.length, suggestions);
            }
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (suggestions.length > 0) {
                weatherWidgetState.selectedSuggestionIndex = weatherWidgetState.selectedSuggestionIndex === 0 ?
                    suggestions.length - 1 :
                    weatherWidgetState.selectedSuggestionIndex - 1;

                selectSuggestion(weatherWidgetState.selectedSuggestionIndex % suggestions.length, suggestions);
            }
        } else if (event.key === "Enter") {
            event.preventDefault();
            const inputValue = autocompleteInput.value.trim();
            handleSearchSubmit(inputValue, weatherWidgetState.selectedSuggestionIndex);
        }

    }

    async function clearButtonClickHandler(event) {
        const { helperText, autocompleteInput, autocompleteResults, searchResults } = weatherWidgetState;
        event.preventDefault();
        indicateErrorMessage(true);
        displayAutocompleteResults(false);
        autocompleteInput.value = '';
        helperText.style.display = 'none';
        autocompleteResults.innerHTML = ``;
        searchResults.innerHTML = ``;

    }

    async function searchButtonClickHandler(event) {
        const { autocompleteInput } = weatherWidgetState;
        event.preventDefault();
        const inputValue = autocompleteInput.value;
        handleSearchSubmit(inputValue, 0);
    }

    async function addAsyncHandlerEvent(element, event, handler) {
        element.addEventListener(event, handler)
    }

    async function widjetInjection(targetElement, widgetElement) {
        addDragAndDrop(widgetElement);
        if (targetElement) {
            widgetElement.style.position = 'absolute';
            targetElement.insertBefore(widgetElement, targetElement.firstChild);
        } else {
            widgetElement.style.position = "fixed";
            document.body.insertBefore(widgetElement, document.body.firstChild);
            addTopIfOtherHeaders(widgetElement);
        }
    }

    return async function runWeatherWidgetScript() {
        // add css link tag to target HTML
        const link = createLinkTag('stylesheet', 'text/css', config.CSS_URL);
        document.head.appendChild(link);

        // create wrapper for the widget
        const wrapperDiv = createElement('div', 'weather-widget');


        // Create the autocomplete element
        const autocompleteContainer = createElement('div', "autocomplete-container", initialautocompleteContainerHtml)
        wrapperDiv.appendChild(autocompleteContainer);

        // get and inject the widget element to target
        const targetElement = getElementById(weatherWidgetState.targetInjectionDiv)
        await widjetInjection(targetElement, wrapperDiv);

        //add elements to state
        const elementsObj = {
            searchButton: "search-button", errorMessage: "error-message", searchResults: "search-results", clearButton: "clear-button",
            autocompleteInput: "autocomplete-input", autocompleteResults: "autocomplete-results", helperText: "helper-text",
        }
        addElementsToState(elementsObj);

        const { autocompleteInput, searchButton, clearButton } = weatherWidgetState;

        // weatherWidgetState.selectedSuggestionIndex = -1;
        // weatherWidgetState.autocompleteResultsData = []

        //add event handlers to components
        addAsyncHandlerEvent(autocompleteInput, "input", inputChangeHandler);
        addAsyncHandlerEvent(autocompleteInput, "keydown", onInputKeyDownHandler)
        addAsyncHandlerEvent(searchButton, "click", searchButtonClickHandler)
        addAsyncHandlerEvent(clearButton, "click", clearButtonClickHandler)

    };


}

weatherWidgetInit()();