import React, { useContext } from "react";
import { View, Image, StyleSheet } from "react-native";
import { AuthContext } from "../context/AuthContext";

const AVATAR_IMAGES = {
  "1":  require("../../assets/Avatar-1.png"),
  "2":  require("../../assets/Avatar-2.png"),
  "3":  require("../../assets/Avatar-3.png"),
  "4":  require("../../assets/Avatar-4.png"),
  "5":  require("../../assets/Avatar-5.png"),
  "6":  require("../../assets/Avatar-6.png"),
  "7":  require("../../assets/Avatar-7.png"),
  "8":  require("../../assets/Avatar-8.png"),
  "9":  require("../../assets/Avatar-9.png"),
  "10": require("../../assets/Avatar-10.png"),
  "11": require("../../assets/Avatar-11.png"),
  "12": require("../../assets/Avatar-12.png"),
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
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#c8e6c9",
    alignItems: "center",
    justifyContent: "center"
  },
  image: {
    width: "95%",
    height: "95%"
  }
});