//////////////
// TUTORIAL //
//////////////

var numberTips = document.querySelectorAll('#tutorial .tutorial_tip').length,
    currentTip = 1;

function showTip(tipNum) {
  document.querySelector('#tutorial #tutorial_tip-' + tipNum).className = 'is-visible tutorial_tip';
  // If this is the final tip, record that the user has seen all the tips.
  if (currentTip === numberTips) {
    setNumTimesTutorialShown( getNumTimesTutorialShown() + 1 );
  }
}

function hideTip(tipNum) {
  document.querySelector('#tutorial #tutorial_tip-' + tipNum).className = 'tutorial_tip';
}

function nextTip() {
  hideTip(currentTip);
  if (currentTip < numberTips) {
    showTip(++currentTip);
  }
}

function getNumTimesTutorialShown() {
  localStorage.getItem('numTimesTutorialShown');
}

function setNumTimesTutorialShown(num) {
  localStorage.getItem('numTimesTutorialShown', num);
}
