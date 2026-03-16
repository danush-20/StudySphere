import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";
import { signInWithEmailAndPassword } from "firebase/auth";

import { auth, db } from "./firebase";

export const registerUser = async (email, password, username ,phone, academic, exam, location) => {

  console.log("Register button pressed");

  try {

    const userCredential =
      await createUserWithEmailAndPassword(auth, email, password);

    const uid = userCredential.user.uid;
    const user = userCredential.user;

    await setDoc(doc(db, "users", uid), {
      email,
      phone,
      username,
      academic,
      exam,
      location
    });

    console.log("User Registered:", uid);
    await sendEmailVerification(user);


    return uid;

  } catch (error) {

    console.log(error.message);
    throw error;

  }

};

export const loginUser = async (email, password) => {

  const userCredential =
    await signInWithEmailAndPassword(auth, email, password);

  const user = userCredential.user;

  if (!user.emailVerified) {
    throw new Error("Please verify your email before logging in.");
  }

  return user;

};