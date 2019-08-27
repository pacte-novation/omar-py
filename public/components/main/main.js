import React, { Component, Fragment } from 'react';
import {
  EuiButton,
  EuiForm,
  EuiFormRow,
  EuiHorizontalRule,
  EuiPage,
  EuiPageBody,
  EuiPageContent,
  EuiPageContentBody,
  EuiPageHeader,
  EuiPageHeaderSection,
  EuiImage,
  EuiConfirmModal,
  EuiOverlayMask,
  EuiSuperSelect,
  EuiCallOut,
  EuiProgress,
  EuiComboBox,
  EuiSpacer,
  EuiText,
  EuiFlexItem,
  EuiDescriptionList,
  EuiFieldNumber
} from '@elastic/eui';
import io from "socket.io-client";

export class Main extends Component {

  constructor(props) {
    super(props);
    this.httpClient = this.props.httpClient;
    this.envVars = this.props.envVarsService.get();
    this.state = {
      selectedIndex: '',
      selectedTimeField: [],
      selectedPredictField: [],
      selectedFeatureFields: [],
      dateFields: [],
      predictFields: [],
      openIndexAndCount: [],
      isModalVisibleTrain: false,
      isModalVisiblePredict: false,
      isTrainButtonDisabled: true,
      isPredictButtonDisabled: true,
      isTimeFieldSelectDisabled: true,
      isPredictFieldSelectDisabled: true,
      errorNoTime: false,
      isFeaturesFieldSelectDisabled: true,
      isPythonEnvInProgress: false,
      isPythonEnvSuccess: true,
      errorTrain: false,
      errorPredict: false,
      isPredictionInProgress: false,
      isModalVisibleMemoryErr: false,
      timeStep: 4
    };
  }

  componentDidMount() {

    this.socket = io.connect(window.location.protocol + '//' + window.location.hostname + ':' + this.envVars.socketPort);
    this.socket.on("progressEnv", (data) => { this.onProgressEnvReceive(data) });
    this.socket.on("progressTrain", (data) => { this.onProgressTrainReceive(data) });
    this.socket.on("progressPredict", (data) => { this.onProgressPredictReceive(data) });
    this.socket.on("PYTHON_PID", (data) => { this.PYTHON_PID = data; });


    this.httpClient.get('../api/omar-py/indices').then((resp) => {
      this.setState({
        openIndexAndCount: resp.data
      });
    });
    this.getCurrentModel();

  }

  componentWillUnmount() {
    this.socket.disconnect();
  }

  componentWillMount() {
    this.checkingPythonEnv();
  }

  getCurrentModel = () => {
    this.httpClient.get('../api/omar-py/omar-model').then((resp) => {
      this.setState(resp.data);
      if (resp.data.currentModel) {
        this.setState({
          isPredictButtonDisabled: false
        })
      }
    });
  }

  closeModalTrain = () => {
    this.setState({ isModalVisibleTrain: false });
  };

  showModalTrain = () => {
    this.httpClient.get('../api/omar-py/memory/' + this.state.selectedIndex + '/' + this.state.selectedFeatureFields.length).then((resp) => {
      const { memoryErr, usedMemory, errorMess } = resp.data;
      if (memoryErr) {
        this.setState({
          isModalVisibleMemoryErr: memoryErr
        });
      }
      else { this.setState({ isModalVisibleTrain: true }); }
    })

  };

  closeModalPredict = () => {
    this.setState({ isModalVisiblePredict: false });
  };

  showModalPredict = () => {
    this.setState({ isModalVisiblePredict: true });
  };

  onProgressEnvReceive = (data) => {
    this.setState(data);
    const { progressEnv, errorEnv } = data;
    if (!errorEnv && (progressEnv >= 100)) {
      this.setState({
        isPythonEnvSuccess: true,
        isPythonEnvInProgress: false
      });
    }
    if (errorEnv && (progressEnv < 100)) {
      this.setState({
        isPythonEnvSuccess: false
      });
    }
  }

  onProgressTrainReceive = (data) => {
    this.setState(data);
    const { progressTrain, errorTrain, messTrain, lastStageOfTrain } = data;
    this.setState({
      progressTrain: progressTrain,
      messTrain: messTrain,
      errorTrain: errorTrain,
      lastStageOfTrain: lastStageOfTrain
    });
    if (errorTrain === true || (progressTrain >= 100 && lastStageOfTrain === true)) {

      this.getCurrentModel();
      this.setState({
        isTrainInProgress: false,
        isTrainButtonDisabled: false
      })
    }
  }

  onProgressPredictReceive = (data) => {
    this.setState(data);
    const { progressPredict, errorPredict, messPredict, lastStageOfPredict } = data;
    this.setState({
      progressPredict: progressPredict,
      errorPredict: errorPredict,
      messPredict: messPredict
    });
    if (errorPredict || (progressPredict >= 100 && lastStageOfPredict)) {
      this.setState({
        isPredictionInProgress: false
      });
    }
  }

  onSelectedIndexChange = (value) => {
    this.httpClient.get('../api/omar-py/fields/' + value).then((resp) => {
      const { fDate, fNoDate, quantitative, qualitative } = resp.data;
      this.setState({
        selectedIndex: value,
        dateFields: fDate.map(el => ({ label: el })),
        predictFields: quantitative.map(el => ({ label: el })),
        featureFields: fNoDate.map(el => ({ label: el })),
        isTimeFieldSelectDisabled: false,
        isPredictFieldSelectDisabled: true,
        isTrainButtonDisabled: true,
        selectedPredictField: [],
        errorNoTime: (fDate.length < 1),
        selectedFeatureFields: [],
        selectedTimeField: [],
        isFeaturesFieldSelectDisabled: true,
        errorTrain: false
      });
    });

  }

  onselectedTimeFieldChange = (value) => {
    this.setState({
      selectedTimeField: value,
      selectedPredictField: [],
      isPredictFieldSelectDisabled: false,
      isTrainButtonDisabled: true,
      selectedFeatureFields: [],
      isFeaturesFieldSelectDisabled: true,
      errorTrain: false,
      errorPredict: false
    });
  }

  onChangeTimeField = selectedTimeField => {
    this.setState({
      selectedTimeField: selectedTimeField,
      selectedPredictField: [],
      isPredictFieldSelectDisabled: false,
      isTrainButtonDisabled: true,
      selectedFeatureFields: [],
      isFeaturesFieldSelectDisabled: true,
      errorTrain: false,
      errorPredict: false,
    })
  }

  onSelectedPredictFieldChange = (selectedPredictField) => {
    this.setState({
      selectedPredictField: selectedPredictField,
      isTrainButtonDisabled: true,
      featureFieldsWithoutPredict: this.state.featureFields.filter(el => el.label != selectedPredictField[0].label),
      selectedFeatureFields: [],
      isFeaturesFieldSelectDisabled: false,
      errorTrain: false,
      errorPredict: false
    });
  }

  onChangeFeatures = selectedFeatureFields => {
    this.setState({
      selectedFeatureFields: selectedFeatureFields,
      isTrainButtonDisabled: selectedFeatureFields.length == 0,
      errorPredict: false,
      errorTrain: false
    })
  }

  onTrainButtonClick = () => {
    const { selectedIndex, selectedTimeField, selectedPredictField, selectedFeatureFields, timeStep } = this.state;
    const payload = {
      index: selectedIndex,
      timeField: selectedTimeField[0].label,
      predictField: selectedPredictField[0].label,
      featureFields: selectedFeatureFields.map(el => el.label).join(','),
      timeStep: timeStep
    }
    this.httpClient.post('../api/omar-py/train', payload)
    this.setState({
      isModalVisibleTrain: false,
      isModalVisibleMemoryErr: false,
      isLoadDataInProgress: true,
      isTrainInProgress: true,
      isPretreatDataInProgress: true
    });
  }

  onPredictButtonClick = () => {
    this.httpClient.post('../api/omar-py/predict', {});
    this.setState({
      isModalVisiblePredict: false,
      isPredictionInProgress: true,
    });
  }

  displayMessErrorTrain = (isVisible) => {
    const title = this.state.messTrain === "" ? "Canceled" : this.state.messTrain;
    if (isVisible) {
      return (
        <div>
          <EuiCallOut title={title} color="warning" iconType="alert" />
          <br />
        </div>
      )
    }
  }

  displayMessErrorPredict = (isVisible) => {
    const title = this.state.messPredict === "" ? "Canceled" : this.state.messPredict;
    if (isVisible) {
      return (
        <div>
          <EuiCallOut title={title} color="warning" iconType="alert" />
          <br />
        </div>
      )
    }
  }

  displayCallOut = (isVisible) => {
    if (isVisible) {
      return (
        <EuiCallOut title="Sorry, there is no 'date' type in your index ! Choose another one. " color="warning" iconType="alert" />
      )
    }
  }

  onCancelPredict = () => {
    this.httpClient.get('../api/omar-py/kill-process/' + this.PYTHON_PID).then(() => {
      this.setState({
        isPredictInProgress: false
      })
    })
  }

  onCancelTrain = () => {
    this.httpClient.get('../api/omar-py/kill-process/' + this.PYTHON_PID).then(() => {
      this.setState({
        isTrainInProgress: false,
        isTrainButtonDisabled: false
      })
    })
  }

  displayProgressBarTrain = (isVisible) => {
    if (isVisible) {
      return (
        <div>
          <EuiFormRow>
            <EuiButton onClick={this.onCancelTrain} color='danger' style={{ width: 600 }} fill={true}>Cancel</EuiButton>
          </EuiFormRow>
          <EuiFlexItem>
            <EuiProgress value={this.state.progressTrain} max={100} size="s" />
          </EuiFlexItem>
          <br />
          <p>{this.state.messTrain} </p>
        </div>
      );
    };
  }

  displayProgressBarPredict = (isVisible) => {
    if (isVisible) {
      return (
        <div>
          <EuiFormRow>
            <EuiButton onClick={this.onCancelPredict} color='danger' style={{ width: 600 }} fill={true}> Cancel </EuiButton>
          </EuiFormRow>
          <EuiFormRow>
            <EuiProgress value={this.state.progressPredict} max={100} size="s" />
          </EuiFormRow>
          <br />
          <p>{this.state.messPredict} </p>
        </div>
      );
    };
  }

  displayProgressBarLoadData = (isVisible) => {
    if (isVisible) {
      return (
        <div>
          <EuiFormRow>
            <EuiButton onClick={this.onCancelTrain} color='danger' style={{ width: 600 }} fill={true}>Cancel</EuiButton>
          </EuiFormRow>
          <EuiFormRow>
            <EuiProgress value={this.state.progressLoadData} max={100} size="s" />
          </EuiFormRow>
          <p>{this.state.LoadDataMess}</p>
        </div>
      );
    };
  }

  displayProgressBarPreatreatData = (isVisible) => {
    if (isVisible) {
      return (
        <div>
          <EuiFormRow>
            <EuiButton onClick={this.onCancelTrain} color='danger' style={{ width: 600 }} fill={true}>Cancel</EuiButton>
          </EuiFormRow>
          <EuiFormRow>
            <EuiProgress value={this.state.progressPretreatData} max={100} size="s" />
          </EuiFormRow>
          <p>{this.state.LoadDataMess}</p>
        </div>
      );
    };
  }

  displayTrainButton = (isVisible) => {
    if (isVisible) {
      return (
        <EuiFormRow>
          <EuiButton onClick={this.showModalTrain} isDisabled={this.state.isTrainButtonDisabled} style={{ width: 600 }} fill={true}>Train</EuiButton>
        </EuiFormRow>
      );
    };
  }

  displayPredictButton = (isVisible) => {
    if (isVisible) {
      return (
        <div>
          <EuiFormRow >
            <EuiButton onClick={this.showModalPredict} isDisabled={this.state.isPredictButtonDisabled} style={{ width: 600 }} fill={true}>
              Predict
          </EuiButton>
          </EuiFormRow>
          {this.displayModelParams(this.state.currentModel)}
        </div>
      );
    };
  }

  displayModelParams = (isVisible) => {
    if (isVisible) {
      const lisFeatures = this.state.currentModel ? this.state.currentModel.featureFields.map(el => ({ description: ' - ' + el })) : '';
      const text = [<h2 key={0}>THE MODEL</h2>,
      <ul key={3}>
        <li>
          <strong>{this.state.currentModel ? 'Index : ' : ''}</strong>
          {this.state.currentModel ? this.state.currentModel.index : ''}
        </li>
        <li>
          <strong>{this.state.currentModel ? 'Time Field : ' : ''}</strong>
          {this.state.currentModel ? this.state.currentModel.timeField : ''}
        </li>
        <li><strong>{this.state.currentModel ? 'Predict Field : ' : ''}</strong>
          {this.state.currentModel ? this.state.currentModel.predictField : ''}
        </li>
        <li><strong>{this.state.currentModel ? 'Features : ' : ''}</strong>
          <EuiSpacer size="xs" />
          <EuiDescriptionList listItems={lisFeatures} align="left" />
        </li>
      </ul>,]
      return (
        <div style={{ maxWidth: '400px' }}>
          <EuiPageContent className="guideDemo__textLines" style={{ padding: 10 }} verticalPosition="center" horizontalPosition="center">
            <EuiPageContentBody>
              <EuiText >{text}</EuiText>
            </EuiPageContentBody>
          </EuiPageContent>
        </div>
      );
    }
  }

  optionDisplay = (index, count) => {
    return (
      <Fragment>
        <p>{index}</p>
        <EuiSpacer size="xs" />
        <EuiText size="s" color="subdued">
          <p className="euiTextColor--subdued">
            {count} documents
          </p>
        </EuiText>
      </Fragment>
    );
  }

  displayModalMemoryErr = (isVisible) => {
    if (isVisible) {
      return (
        <EuiOverlayMask>
          <EuiConfirmModal
            title="DANGER !"
            onCancel={this.closeModalMemoryErr}
            onConfirm={this.onTrainButtonClick}
            cancelButtonText="Cancel"
            confirmButtonText="Continue"
            defaultFocusedButton="confirm"
            buttonColor='danger'>
            <p>You&rsquo;re about to train on a index that may be to important for your cumputer to do the train</p>
            <p>Are you sure you want to do this?</p>
            <p>We recomand you choose another index.</p>
          </EuiConfirmModal>
        </EuiOverlayMask>
      );
    }
  }

  closeModalMemoryErr = () => {
    this.setState({
      isModalVisibleMemoryErr: false
    });
  };



  displayModalTrain = (isVisible) => {
    if (isVisible) {
      const { openIndexAndCount, selectedIndex, selectedPredictField } = this.state;
      const count = openIndexAndCount.find(el => el.index == selectedIndex).count
      return (
        <EuiOverlayMask>
          <EuiConfirmModal
            title="Train"
            onCancel={this.closeModalTrain}
            onConfirm={this.onTrainButtonClick}
            cancelButtonText="Cancel"
            confirmButtonText="Train"
            defaultFocusedButton="confirm">
            <p>You&rsquo;re about to train the default model on the {count} documents of the index {selectedIndex} to predict the field {selectedPredictField[0].label} </p>
            <p>Are you sure you want to do this?</p>
          </EuiConfirmModal>
        </EuiOverlayMask>
      );
    }
  }

  displayModalPredict = (isVisible) => {
    if (isVisible) {
      return (
        <EuiOverlayMask>
          <EuiConfirmModal
            title="Predict"
            onCancel={this.closeModalPredict}
            onConfirm={this.onPredictButtonClick}
            cancelButtonText="Cancel"
            confirmButtonText="Predict"
            defaultFocusedButton="confirm">
            <p>You&rsquo;re about to launch the prediction on the default trained model.</p>
            <p>Are you sure you want to do this?</p>
          </EuiConfirmModal>
        </EuiOverlayMask>
      );
    }
  }

  checkingPythonEnv = () => {
    this.httpClient.get('../api/omar-py/check-python-env').then((resp) => {
      if (!resp.data.error) {
        const { uninstalledDeps } = resp.data;
        if (uninstalledDeps.length > 0) {
          this.setState({
            isPythonEnvInProgress: true
          });
          this.httpClient.post('../api/omar-py/install-uninstalled-deps', { uninstalledDeps: uninstalledDeps })
        } else {
          this.setState({
            isPythonEnvSuccess: true
          });
        }
      } else {
        this.setState({
          errorEnv: true,
          messEnv: resp.data.error,
          isPythonEnvSuccess: false
        })
      }
    })
  }

  onProgressEnvReceive = (data) => {
    const { progressEnv, errorEnv, messageEnv } = data
    this.setState({
      progressEnv: progressEnv,
      errorEnv: errorEnv,
      messageEnv: messageEnv
    })
    if (!errorEnv && (progressEnv >= 100)) {
      this.setState({
        isPythonEnvSuccess: true,
        isPythonEnvInProgress: false
      });
    }
    if (errorEnv && (progressEnv < 100)) {
      this.setState({
        isPythonEnvSuccess: false
      });
    }
  }

  displayProgressBarPythonEnv = (isVisible) => {
    if (isVisible) {
      return (
        <EuiPageBody>
          <EuiPageContent verticalPosition="center" horizontalPosition="center">
            <EuiPageContentBody  >
              <EuiImage
                size="l"
                url='../plugins/omar-py/ressources/omar-py_logo_text.svg'
                alt="omar-py"
              />
              <EuiHorizontalRule margin="s" />
              <EuiSpacer size="s" />
              <p>Installation de l'environnement Python en cours...</p>
              <br />
              <EuiProgress value={this.state.progressEnv} max={100} size="l" />
              <br />
              <p>{this.state.messageEnv}</p>
            </EuiPageContentBody  >
          </EuiPageContent>
        </EuiPageBody>
      );
    };
  }

  displayErrorOnPythonEnv = (isVisible) => {
    if (isVisible) {
      return (
        <EuiPageBody>
          <EuiPageContent verticalPosition="center" horizontalPosition="center" >
            <EuiPageContentBody  >
              <blockquote><EuiImage
                size="l"
                url='../plugins/omar-py/ressources/omar-py_logo_text.svg'
                alt="omar-py"
              /></blockquote>
              <EuiCallOut title={this.state.messageEnv} color="danger" iconType="alert">
              </EuiCallOut>
            </EuiPageContentBody  >
          </EuiPageContent>
        </EuiPageBody>
      )
    }
  }

  onChangetimeStep = e => {
    const selectedTime = parseInt(e.target.value, 10);
    if (selectedTime > 0 && this.state.selectedFeatureFields.length > 1) {
      this.setState({
        timeStep: isNaN(selectedTime) ? '' : selectedTime,
        isTrainButtonDisabled: false
      });
    }
    else {
      this.setState({ isTrainButtonDisabled: true })
    }
  };

  displayNoErrorOnPythonEnv = (isVisible) => {
    if (isVisible) {
      return (
        <EuiPageBody>
          <EuiPageHeader>
            <EuiPageHeaderSection  >
              <EuiImage
                size="l"
                url='../plugins/omar-py/ressources/omar-py_logo_text.svg'
                alt="omar-py"
              />
            </EuiPageHeaderSection>
          </EuiPageHeader>
          {this.displayMessErrorTrain(this.state.errorTrain)}
          {this.displayMessErrorPredict(this.state.errorPredict)}
          {this.displayCallOut(this.state.errorNoTime)}
          <EuiPageContent verticalPosition="center" horizontalPosition="center">
            <EuiPageContentBody  >
              <EuiText><h2 >TEMPORAL ANN</h2></EuiText>
              <br />

              <EuiForm >
                <EuiFormRow label="Pick an opened index">
                  <EuiSuperSelect
                    options={this.state.openIndexAndCount.map(el => ({ value: el.index, inputDisplay: el.index, dropdownDisplay: this.optionDisplay(el.index, el.count) }))}
                    valueOfSelected={this.state.selectedIndex}
                    onChange={this.onSelectedIndexChange}
                    hasDividers
                  />
                </EuiFormRow>
                <EuiFormRow label="Pick the time reference field"  >
                  <EuiComboBox
                    singleSelection={{ asPlainText: true }}
                    isClearable={false}
                    options={this.state.dateFields}
                    selectedOptions={this.state.selectedTimeField}
                    isDisabled={this.state.isTimeFieldSelectDisabled || this.state.errorNoTime}
                    onChange={this.onChangeTimeField}
                  />
                </EuiFormRow>
                <EuiFormRow label="Pick the field that will be predicted"  >
                  <EuiComboBox
                    singleSelection={{ asPlainText: true }}
                    isClearable={false}
                    options={this.state.predictFields}
                    selectedOptions={this.state.selectedPredictField}
                    isDisabled={this.state.isPredictFieldSelectDisabled}
                    onChange={this.onSelectedPredictFieldChange}
                  />
                </EuiFormRow>
                <EuiFormRow label="Pick the fields that will be in the training" >
                  <EuiComboBox
                    options={this.state.featureFieldsWithoutPredict}
                    selectedOptions={this.state.selectedFeatureFields}
                    isDisabled={this.state.isFeaturesFieldSelectDisabled}
                    onChange={this.onChangeFeatures}
                  />
                </EuiFormRow>
                <EuiFormRow label="Pick a time step in minute bigger than 1min (default:4min)">
                  <EuiFieldNumber
                    min={1}
                    placeholder={4}
                    onChange={this.onChangetimeStep}
                  />
                </EuiFormRow>
                {this.displayTrainButton(!this.state.isTrainInProgress)}
                {this.displayModalTrain(this.state.isModalVisibleTrain)}
                {this.displayProgressBarTrain(this.state.isTrainInProgress)}
                {this.displayModalMemoryErr(this.state.isModalVisibleMemoryErr)}
                <EuiHorizontalRule margin="s" />
                <EuiSpacer size="s" />
                {this.displayPredictButton(!this.state.isPredictionInProgress)}
                {this.displayModalPredict(this.state.isModalVisiblePredict)}
                {this.displayProgressBarPredict(this.state.isPredictionInProgress)}
              </EuiForm>
            </EuiPageContentBody>
          </EuiPageContent>
        </EuiPageBody>
      );
    }
  }

  render() {
    return (
      <EuiPage >
        {this.displayErrorOnPythonEnv(!this.state.isPythonEnvSuccess && !this.state.isPythonEnvInProgress)}
        {this.displayProgressBarPythonEnv(this.state.isPythonEnvInProgress)}
        {this.displayNoErrorOnPythonEnv(this.state.isPythonEnvSuccess && !this.state.isPythonEnvInProgress)}
      </EuiPage>
    );
  }
}