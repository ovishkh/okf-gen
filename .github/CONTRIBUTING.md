# Contributing to okf

First off, thank you for considering contributing to okf! It's people like you that make okf such a great tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/ovishkh/okf/issues) to see if someone else has already created a ticket. If not, go ahead and make one using our issue templates!

## Development Setup

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/okf.git
   cd okf
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Build the project and link it locally for testing:
   ```bash
   npm run build
   npm link
   ```

## Making Changes

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b my-awesome-feature
   ```
2. Make your code changes. 
3. Run the validation checks (typechecking, testing, and building) to ensure everything works perfectly:
   ```bash
   npm run check
   ```
4. Commit your changes with a clear and descriptive commit message.
5. Push your branch to your fork:
   ```bash
   git push origin my-awesome-feature
   ```
6. Open a Pull Request on the main repository!

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
