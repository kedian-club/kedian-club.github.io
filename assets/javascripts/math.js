// MathJax is served locally. Only math emitted by Arithmatex is processed.
window.MathJax = {
  chtml: {
    // Custom reading fonts can report a very small x-height. Keep math at its
    // normal size instead of shrinking it to match that font measurement.
    matchFontHeight: false
  },
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true
  },
  options: {
    ignoreHtmlClass: '.*|',
    processHtmlClass: 'arithmatex'
  }
};
