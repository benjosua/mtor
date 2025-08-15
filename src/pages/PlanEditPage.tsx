import PlanEditor from "@/components/PlanEditor";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

const PlanEditPage = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const { t } = useTranslation();

    if (!uuid) {
        return <div>{t('planEditor.planIdMissing')}</div>;
    }

    return (
        <div>
            <PlanEditor planId={uuid} />
        </div>
    )
}

export default PlanEditPage;