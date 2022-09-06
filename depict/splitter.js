let ismdwn = 0
handle.addEventListener('mousedown', mD)

function mD(event) {
  ismdwn = 1
  splitter.addEventListener('mousemove', mV)
  splitter.addEventListener('mouseup', end)
}

function mV(event) {
  if (ismdwn === 1) {
    whiteboard.style.flexBasis = event.clientX + "px";
    slide.style.fontSize = (event.clientX/30) + "px";
  } else {
    end()
  }
}
const end = (e) => {
  ismdwn = 0
  splitter.removeEventListener('mouseup', end)
  splitter.removeEventListener('mousemove', mV)
}
