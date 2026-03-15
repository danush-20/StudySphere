import React, { useContext } from "react";
import { View, Image, StyleSheet } from "react-native";
import { AuthContext } from "../context/AuthContext";

const AVATAR_IMAGES = {
  "1":  require("../../assets/avatar-1.png"),
  "2":  require("../../assets/avatar-1.png"),
  "3":  require("../../assets/avatar-1.png"),
  "4":  require("../../assets/avatar-1.png"),
  "5":  require("../../assets/avatar-1.png"),
  "6":  require("../../assets/avatar-1.png"),
  "7":  require("../../assets/avatar-1.png"),
  "8":  require("../../assets/avatar-2.png"),
  "9":  require("../../assets/avatar-2.png"),
  "10": require("../../assets/avatar-1.png"),
  "11": require("../../assets/avatar-1.png"),
  "12": require("../../assets/avatar-2.png"),
};

export default function AvatarIcon({ size = 34, avatarId }) {

  const { profile } = useContext(AuthContext);
  const id = avatarId || profile?.avatar || "1";
  const source = AVATAR_IMAGES[id] || AVATAR_IMAGES["1"];

  return (
    <View style={[
      styles.circle,
      { width: size, height: size, borderRadius: size / 2 }
    ]}>
      <Image
        source={source}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2
        }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#c8e6c9"
  }
});