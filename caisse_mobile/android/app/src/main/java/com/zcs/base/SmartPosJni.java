package com.zcs.base;

public class SmartPosJni {
    private static SmartPosJni instance;

    static {
        try {
            System.loadLibrary("SmartPosJni");
            android.util.Log.i("ZCS_JNI", "libSmartPosJni.so loaded successfully in com.zcs.base.SmartPosJni");
        } catch (Throwable t) {
            android.util.Log.e("ZCS_JNI", "Failed to load libSmartPosJni.so in com.zcs.base.SmartPosJni: " + t.getMessage());
        }
    }

    private SmartPosJni() {
    }

    public static synchronized SmartPosJni createClass() {
        if (instance == null) {
            instance = new SmartPosJni();
        }
        return instance;
    }

    public native int sdkDeviceOpen();
    public native int sdkOpenBox();
}
