# UI Pack for Kylantis Apps

---

## Getting Started

1. Ensure you have the JDK installed and that `java` and `javadoc` are available in your `PATH`.
2. Fork this repository and add your organization-specific UI components as needed.
3. Run `npm install` (use `nvm use` first if you use nvm).
4. Build all assets:
   ```
   npm run build
   ```
5. The component pack will be generated at `build/jar/fusion-ui.jar`. Add this JAR to your Kylantis application.

---

## Rendering Components

- Start the development server:
  ```
  npm run start-server
  ```
- Access components at:  
  `http://localhost:8090/components/<component_name>`  
  (Compiled components are located in `dist/components/<component_name>`.)

---

## Contributing

Contributions are welcome. Please open issues or submit pull requests to help improve Fusion UI.

---

## Support

For questions or support, contact:  
**web_engineering@kylantis.com**

---

## License

This project is licensed under the MIT License.

