function monetize(when){
    const isOn = !!document.monetization;

    if (isOn) {
        document
            .monetization
            .addEventListener('monetizationstart', when);
    }

    return isOn;
}
