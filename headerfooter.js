// This system just dynamically loads our header and footer onto every page.

fetch('/header.html')
  .then(response => {
    if (!response.ok) {
      throw new Error('Could not load page header!.');
    }
    return response.text();
  }).then(html => {
    document.getElementById('header').innerHTML = html;
  }).catch(error => {
    console.error('Error loading the HTML file:', error);
  });

fetch('/footer.html')
  .then(response => {
    if (!response.ok) {
      throw new Error('Could not load page footer!.');
    }
    return response.text();
  }).then(html => {
    document.getElementById('footer').innerHTML = html;
  }).catch(error => {
    console.error('Error loading the HTML file:', error);
  });