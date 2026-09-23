// Polyfills load before anything else: Kit derives addresses and signs through WebCrypto, which Hermes lacks.
import "./src/polyfills";
import "expo-router/entry";
