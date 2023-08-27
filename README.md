# Weather Widget

This is a simple weather widget that allows you to get weather information for a specific location.

## Usage

To use the weather widget, follow these steps:

1. Open your browser's developer console.

2. Copy and paste the following code lines into the console :

   ```javascript
   var script = document.createElement('script');
   script.src = 'https://rawcdn.githack.com/george14051/weatherWidgetScript/4977251beb45dce10d1b713482d395cee4ed3b20/docs/weatherScript.js';
   script.type = 'text/javascript';
   script.async = true;
   script.setAttribute("targetDiv", "id-of-your-target");
   document.body.appendChild(script);

##  Notes

1. currently the widget not feet to all websites use cases

2. added drag implementation for a case the widget not fit well 
