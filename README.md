# Weather Widget

This is a simple weather widget that allows you to get weather information for a specific location.

## Usage

To use the weather widget, follow these steps:

1. Open your browser's developer console.

2. Copy and paste the following code lines into the console :

   ```javascript
   var script = document.createElement('script');
   script.src = 'https://george14051.github.io/weatherWidgetScript/weatherScript.js';
   script.type = 'text/javascript';
   script.async = true;
   script.setAttribute("targetDiv", "id-of-your-target");
   document.body.appendChild(script);

3. after initial script run use on the browser console the function weatherWidgetInit("id-of-your-target") for inject more widgets to the page.

##  Notes

1. currently the widget not feet to all websites use cases

2. added drag implementation for a case the widget not fit well 
