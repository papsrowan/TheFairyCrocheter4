package com.zcs;

public class SmartPosSysJni {
    private static SmartPosSysJni instance;

    static {
        try {
            System.loadLibrary("SmartPosJni");
            android.util.Log.i("ZCS_JNI", "libSmartPosJni.so loaded successfully in com.zcs.SmartPosSysJni");
        } catch (Throwable t) {
            android.util.Log.e("ZCS_JNI", "Failed to load libSmartPosJni.so in com.zcs.SmartPosSysJni: " + t.getMessage());
        }
    }

    private SmartPosSysJni() {
    }

    public static synchronized SmartPosSysJni createClass() {
        if (instance == null) {
            instance = new SmartPosSysJni();
        }
        return instance;
    }

    public native int sdkDeviceOpen();
    public native int sdkOpenBox();
}
