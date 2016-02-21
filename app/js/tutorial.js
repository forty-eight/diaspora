//////////////
// TUTORIAL //
//////////////

var numberTips = document.querySelectorAll('#tutorial .tutorial_tip').length,
    currentTip = 1,
    tipTimer;

function showTip(tipNum) {
  document.querySelector('#tutorial #tutorial_tip-' + tipNum).className = 'is-visible tutorial_tip';
  currentTip++;
}

function hideTip(tipNum) {
  document.querySelector('#tutorial #tutorial_tip-' + tipNum).className = 'tutorial_tip';
}

function nextTip() {
  if (currentTip - 1) hideTip(currentTip - 1);
  if (currentTip <= numberTips) {
    showTip(currentTip);
  } else {
    // If this is the final tip, record that the user has seen all the tips.
    setNumTimesTutorialShown( (getNumTimesTutorialShown() || 0) + 1 );
    clearInterval(tipTimer);
  }
}

function autoTip() {
  tipTimer = setInterval(function() {
    nextTip();
  }, 10000);
}

function getNumTimesTutorialShown() {
  localStorage.getItem('numTimesTutorialShown');
}

function setNumTimesTutorialShown(num) {
  localStorage.setItem('numTimesTutorialShown', num);
}
