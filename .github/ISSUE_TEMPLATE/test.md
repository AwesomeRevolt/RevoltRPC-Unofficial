name: "🚀 New Game to Detection"
description: Suggest a new game to be added to the games.json detection list
labels: [enhancement, game-detection]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for contributing! Please fill out the following fields to help us verify and add the game to detection.
  - type: input
    id: game-name
    attributes:
      label: 🎮 Game Name
      description: What is the name of the game as you'd like it shown in status?
      placeholder: e.g. Fallout 4
    validations:
      required: true
  - type: input
    id: exe-name
    attributes:
      label: 🗂️ Executable Name
      description: What is the exact filename of the game process? (Case-sensitive)
      placeholder: e.g. Fallout4.exe
    validations:
      required: true
  - type: textarea
    id: confirmation
    attributes:
      label: ✅ Testing Confirmation
      description: Please confirm that you have tested this locally and it correctly updates.
      placeholder: e.g. Yes, I have tested this with my local setup and it works as expected.
    validations:
      required: true
