import { install } from "react-native-quick-crypto";

// Patches global.crypto (getRandomValues + subtle with Ed25519) and global.Buffer.
install();
