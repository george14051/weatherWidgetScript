function weatherWidgetScript() {
    const config = {
        CSS_URL: 'https://george14051.github.io/weatherWidgetScript/styles.css',
        API_WEATHER_HISTORY_URL: 'https://api.open-meteo.com/v1/forecast',
        API_WEATHER_HISTORY_DAILY_PARAMETERS: '&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=GMT&past_days=31',
        API_AUTOCOMPLETE_URL: 'https://geocoding-api.open-meteo.com/v1/search',
        COORDINATES_REGEX: /^((\-?|\+?)?\d+(\.\d+)?),\s*((\-?|\+?)?\d+(\.\d+)?)$/gi,
        WEEK_DAYS: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    }

    const commonState = {
        componentAmount: 0,
        isInitialRun: true,
        targetInjectionDivId: document.currentScript?.getAttribute('targetDiv')
    };

    return function createWeatherWidgetInstance(divid) {

        const weatherWidgetState = {
            selectedSuggestionIndex: -1,
            autocompleteResultsData: [],
            targetDivId: divid,
            widgetIndex: 0
        }
        function createAutoCompleteContainerHtml() {
            const { widgetIndex } = weatherWidgetState;
            return `
            <div id="autocomplete-top-container${widgetIndex}" class="autocomplete-top-container">
                <button id="clear-button${widgetIndex}" class="btnWeather clear-button">clear</button>
                <input type="text" id="autocomplete-input${widgetIndex}" class="autocomplete-input" placeholder="search by city or coordinates lon,lat (e.g. '43.03333 , 17.64306')">
                <button id="search-button${widgetIndex}" class="btnWeather search-button">search</button>
            </div>
            <div id="error-message${widgetIndex}" class="error-message" style="display: none; color: red;"></div>
            <div id="helper-text${widgetIndex}" class="helper-text" style="display: none; color: blue; padding-left: 6px;"></div>
            <ul id="autocomplete-results${widgetIndex}" class="autocomplete-results" style="display: none;"></ul>
            <div id="search-results${widgetIndex}" class="search-results"></div>
        `
        }

        function getElementById(elementId) {
            return document.getElementById(elementId);
        }

        async function fetchData(url) {
            try {
                const response = await fetch(url);
                console.log('response', response);
                if (!response.ok) {
                    throw new Error(`Request fetchData failed: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.log(error);
                console.error('fetchData error:', error);
                throw error
            }
        }
        async function fetchHistoryWeather(latitude, longitude) {
            const { API_WEATHER_HISTORY_URL, API_WEATHER_HISTORY_DAILY_PARAMETERS } = config;
            try {
                const url = `${API_WEATHER_HISTORY_URL}?latitude=${latitude}&longitude=${longitude}${API_WEATHER_HISTORY_DAILY_PARAMETERS}`;
                const historyData = await fetchData(url);
                console.log('historyData', historyData);
                return historyData;
            } catch (error) {

                checkIfCoordinates(`${latitude},${longitude}`) ? setHelperText(true, 'blue', `dont find data for (${latitude},${longitude})`)
                    : setHelperText(false) & indicateErrorMessage(false, 'Invalid input');
                throw error;
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
            console.log('query', query);
            const { API_AUTOCOMPLETE_URL } = config;
            const data = await fetchData(`${API_AUTOCOMPLETE_URL}?name=${query}&count=10`);
            console.log('data', data);
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

        async function createWeatherCards(latitude, longitude, searchValue = undefined) {
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
                    <div class="day">${config.WEEK_DAYS[dayIndex]}</div>
                `;
                    weatherWidgetState.searchResults.appendChild(card);
                });
            } catch (error) {
                throw error;
            }
        }

        function calculateAvarageWeather(historyWeather) {
            let dayTemperatures = Array.from({ length: 7 }, () => ({ maxTemperatureAvg: 0, minTemperatureAvg: 0, count: 0 }));
            // got from the api also forcast of 7 days so removed them.
            historyWeather.time.splice(31);
            historyWeather.time.forEach((date, index) => {
                const dayIndex = new Date(date).getDay();
                const { maxTemperatureAvg, minTemperatureAvg, count } = dayTemperatures[dayIndex];
                dayTemperatures[dayIndex] = {
                    maxTemperatureAvg: maxTemperatureAvg + historyWeather.temperature_2m_max[index],
                    minTemperatureAvg: minTemperatureAvg + historyWeather.temperature_2m_min[index],
                    count: count + 1
                }
            })

            const averageTemperatures = dayTemperatures.map(({ maxTemperatureAvg, minTemperatureAvg, count }) => ({
                maxTemperatureAvg: Math.floor(maxTemperatureAvg / count),
                minTemperatureAvg: Math.floor(minTemperatureAvg / count)
            }));

            return averageTemperatures
        }

        function checkIfCoordinates(value) {
            const regexExpCoordinates = config.COORDINATES_REGEX;
            const trimmedValue = value.split(" ").join("");
            return regexExpCoordinates.test(trimmedValue)
        }

        //check if the target website have fixed header and add top to the injected element
        function addTopIfOtherHeaders(element) {

            const headersTags = document.getElementsByTagName("header");
            const headerTagsArray = Object.values(headersTags);
            let headerStickyHeight = 0;
            headerTagsArray.forEach((header) => {
                const computedStyleHeader = window.getComputedStyle(header, null);
                const positionHeader = computedStyleHeader.getPropertyValue('position');
                if (positionHeader === 'fixed' || positionHeader === 'sticky') {
                    resPosition = positionHeader;
                    let heightHeader = parseInt(computedStyleHeader.getPropertyValue('height'));
                    headerStickyHeight = Math.max(headerStickyHeight, heightHeader);
                }
            })
            element.style.top = `${headerStickyHeight}px`;
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
                console.log(autocompleteInput.value);
                console.log(inputValue);
                console.log(inputType);
                switch (inputType) {
                    case 'string': {
                        if (autocompleteResultsData?.length > 0) {
                            if (suggestedIndex === -1) {
                                indicateErrorMessage(false, 'type new input for other location');;
                            } else {
                                const selectedOption = autocompleteResultsData[suggestedIndex];
                                await createWeatherCards(selectedOption.latitude, selectedOption.longitude, selectedOption.name);
                            }
                        } else {
                            indicateErrorMessage(false);
                        }
                        break;
                    }
                    case 'coordinates': {
                        setHelperText(false);
                        const [latitude, longitude] = inputValue.split(',').map(coordinate => coordinate.trim());
                        console.log('latitude', latitude);
                        console.log('longitude', longitude);
                        await createWeatherCards(latitude, longitude);
                        break;
                    }
                    default: {
                        setHelperText(false)
                        indicateErrorMessage(false, inputLen < 2 ? "At least 2 characters required" : 'invalid input');
                    }

                }

                setLocalState({ selectedSuggestionIndex: -1 })
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
            const { widgetIndex } = weatherWidgetState;
            for (const [key, value] of Object.entries(elementsObjects)) {
                weatherWidgetState[key] = getElementById(value + widgetIndex);
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

        function setInputTypeState(inputLen, isCoordiantion, value) {
            let type;
            if (inputLen) {
                if (isCoordiantion) {
                    type = 'coordinates';
                } else if (isNaN(value[0])) {
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

        function setHelperText(show, color = 'blue', message = 'coordinates format ex. - 43.03333 , 17.64306') {
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
            setLocalState({ selectedSuggestionIndex: 0 })
            indicateErrorMessage(true);
            setHelperText(false);

            const inputLen = inputValue.length
            //set inputType
            console.log('inputValue', inputValue)
            const currInputType = setInputTypeState(inputLen, checkIfCoordinates(inputValue), inputValue)

            console.log('currInputType', currInputType)


            switch (currInputType) {
                case 'string': {
                    setHelperText(false);
                    const optionsList = await debouncedPerformAutocomplete(inputValue);
                    handleChangeAutocompleteResults(optionsList.results || []);
                    break;
                }
                case 'coordinates': {
                    indicateErrorMessage(true);
                    setHelperText(true, 'green');
                    break;
                }
                case 'number': {
                    indicateErrorMessage(true);
                    setHelperText(true);
                    break;
                }
                default: {
                    indicateErrorMessage(true)
                    displayAutocompleteResults(false);
                }

            }

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
                await handleSearchSubmit(inputValue, weatherWidgetState.selectedSuggestionIndex);
                weatherWidgetState.selectedSuggestionIndex = -1;
            }

        }

        function clearButtonClickHandler(event) {
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
            const { autocompleteInput, selectedSuggestionIndex } = weatherWidgetState;
            event.preventDefault();
            const inputValue = autocompleteInput.value;
            handleSearchSubmit(inputValue, selectedSuggestionIndex);
        }

        function addHandlerEvent(element, event, handler) {
            element.addEventListener(event, handler)
        }

        async function widjetInjection(targetElement, targetElementStyles, widgetElement) {
            addDragAndDrop(widgetElement);
            if (targetElement !== document.body) {
                widgetElement.style.position = 'relative';
                targetElement.insertBefore(widgetElement, targetElement.firstChild);
            } else {
                widgetElement.style.position = "fixed";
                document.body.insertBefore(widgetElement, document.body.firstChild);
                addTopIfOtherHeaders(widgetElement);
            }
        }

        function getTargetElement(divId) {
            let targetElement;
            if (divId) {
                targetElement = getElementById(divId);
            }

            if (!targetElement) {
                targetElement = document.body
            }
            return targetElement;
        }

        function setLocalState(objectData) {
            for (const [key, value] of Object.entries(objectData)) {
                weatherWidgetState[key] = value;
            }
        }


        (async function runWeatherWidgetScript() {

            const { targetInjectionDiv, isInitialRun, componentAmount } = commonState;

            let selfIndex = componentAmount;
            commonState.componentAmount = componentAmount + 1;

            //check if initial run
            if (isInitialRun) {
                // add css link tag to target HTML
                const link = createLinkTag('stylesheet', 'text/css', config.CSS_URL);
                document.head.appendChild(link);
                commonState.isInitialRun = false;
                setLocalState({ targetDivId: targetInjectionDiv })
            }


            setLocalState({ widgetIndex: selfIndex })

            // create wrapper for the widget
            const wrapperDiv = createElement('div', `weather-widget${selfIndex}`);
            wrapperDiv.classList.add("weather-widget");

            // Create the autocomplete element
            const autocompleteContainer = createElement('div', `autocomplete-container${selfIndex}`, createAutoCompleteContainerHtml())
            autocompleteContainer.classList.add('autocomplete-container');
            wrapperDiv.appendChild(autocompleteContainer);


            // get and inject the widget element to target
            const { targetDivId } = weatherWidgetState;
            const targetElement = getTargetElement(targetDivId);
            const targetElementStyles = getComputedStyle(targetElement);

            await widjetInjection(targetElement, targetElementStyles, wrapperDiv);

            //add elements to state
            const elementsObj = {
                searchButton: "search-button", errorMessage: "error-message", searchResults: "search-results", clearButton: "clear-button",
                autocompleteInput: "autocomplete-input", autocompleteResults: "autocomplete-results", helperText: "helper-text",
            }
            addElementsToState(elementsObj);

            const { autocompleteInput, searchButton, clearButton } = weatherWidgetState;

            //add event handlers to components
            addHandlerEvent(autocompleteInput, "input", inputChangeHandler);
            addHandlerEvent(autocompleteInput, "keydown", onInputKeyDownHandler)
            addHandlerEvent(searchButton, "click", searchButtonClickHandler)
            addHandlerEvent(clearButton, "click", clearButtonClickHandler)

        })();

    }



}

const weatherWidgetInit = weatherWidgetScript();
weatherWidgetInit();
